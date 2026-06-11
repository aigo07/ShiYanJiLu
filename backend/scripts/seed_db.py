from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.curing_agent import CuringAgent
from app.models.experiment import Experiment  # noqa: F401 — register mapper for Record FK
from app.models.material import Material
from app.models.process_type import ProcessType
from app.models.record import Record


ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Paths:
    raw_data_dir: Path
    materials_csv: Path
    catalysts_json: Path


def default_paths() -> Paths:
    raw_data_dir = ROOT / "raw_data"
    return Paths(
        raw_data_dir=raw_data_dir,
        materials_csv=raw_data_dir / "basic_materials.csv",
        catalysts_json=raw_data_dir / "catalysts.json",
    )


def parse_float(s: str | None) -> float | None:
    if s is None:
        return None
    s = str(s).strip()
    if s == "":
        return None
    return float(s)


def parse_material_key(material_key: str) -> tuple[str, str]:
    # e.g. "载体::载体G26" -> ("载体", "载体G26")
    parts = material_key.split("::", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid material_key: {material_key!r}")
    return parts[0].strip(), parts[1].strip()


def parse_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return float(value)


def parse_status_from_json(ca: dict[str, Any]) -> str | None:
    if "status" not in ca:
        return None
    value = ca.get("status")
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def upsert_process_types(db: Session) -> None:
    # Product rule (updated): 挤出、压延、模压 are distinct process types.
    process_type_names = ["挤出", "压延", "模压"]

    # Backward-compat: drop the legacy merged type if it exists.
    old = db.execute(
        select(ProcessType).where(ProcessType.name == "挤出/压延")
    ).scalar_one_or_none()
    if old is not None:
        db.delete(old)

    stmt = insert(ProcessType).values([{"name": n} for n in process_type_names])
    stmt = stmt.on_conflict_do_nothing(index_elements=[ProcessType.name])
    db.execute(stmt)


def upsert_materials(db: Session, materials_csv: Path) -> None:
    if not materials_csv.exists():
        raise FileNotFoundError(str(materials_csv))

    rows: list[dict[str, Any]] = []
    with materials_csv.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            category = (r.get("分类") or "").strip()
            name = (r.get("对外型号") or "").strip()
            if not category or not name:
                continue
            rows.append(
                {
                    "category": category,
                    "name": name,
                    # numeric fields (store-only for now)
                    "hydrogen_content": parse_float(r.get("含氢量")),
                    "vinyl_content": parse_float(r.get("乙烯基含量")),
                    "volatile_min": parse_float(r.get("挥发分min")),
                    "volatile_max": parse_float(r.get("挥发分max")),
                    "avg_mw_wan": parse_float(r.get("平均分子量(万)")),
                    "pt_ppm": parse_float(r.get("铂含量(ppm)")),
                }
            )

    if not rows:
        return

    stmt = insert(Material).values(rows)
    # Upsert numeric fields by (category,name).
    stmt = stmt.on_conflict_do_update(
        constraint="uq_materials_category_name",
        set_={
            "hydrogen_content": stmt.excluded.hydrogen_content,
            "vinyl_content": stmt.excluded.vinyl_content,
            "volatile_min": stmt.excluded.volatile_min,
            "volatile_max": stmt.excluded.volatile_max,
            "avg_mw_wan": stmt.excluded.avg_mw_wan,
            "pt_ppm": stmt.excluded.pt_ppm,
        },
    )
    db.execute(stmt)


def build_material_id_map(db: Session) -> dict[tuple[str, str], int]:
    # key is (category, name)
    q = db.execute(select(Material.id, Material.category, Material.name)).all()
    return {(category, name): mid for (mid, category, name) in q}


def replace_curing_agents_from_json(db: Session, catalysts_json: Path) -> None:
    if not catalysts_json.exists():
        raise FileNotFoundError(str(catalysts_json))

    raw = json.loads(catalysts_json.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("catalysts.json must be an object mapping name -> {items, default_ratio}")

    material_id_map = build_material_id_map(db)

    curing_agent_rows: list[dict[str, Any]] = []
    json_names: set[str] = set()
    for ca_name, ca in raw.items():
        ca_name = str(ca_name).strip()
        if not ca_name:
            continue
        json_names.add(ca_name)
        ca = ca or {}

        items = ca.get("items") or []
        composition: list[dict[str, Any]] = []
        for item in items:
            mk = item.get("物料键")
            frac = item.get("质量百分比")
            if mk is None or frac is None:
                continue

            category, name = parse_material_key(str(mk))
            mid = material_id_map.get((category, name))
            if mid is None:
                continue

            # catalysts.json uses fraction (sums to 1.0). Store as percentage (0-100).
            composition.append({"material_id": mid, "mass_pct": float(frac) * 100.0})

        curing_agent_rows.append(
            {
                "name": ca_name,
                "composition": composition if composition else None,
                "default_ratio": parse_optional_float(ca.get("default_ratio")),
                "status": parse_status_from_json(ca),
            }
        )

    if not curing_agent_rows:
        return

    stmt = insert(CuringAgent).values(curing_agent_rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=[CuringAgent.name],
        set_={
            "composition": stmt.excluded.composition,
            "default_ratio": stmt.excluded.default_ratio,
            "status": stmt.excluded.status,
        },
    )
    db.execute(stmt)

    referenced_ids = set(
        db.execute(
            select(Record.curing_agent_a_id).where(Record.curing_agent_a_id.is_not(None))
        ).scalars()
    ) | set(
        db.execute(
            select(Record.curing_agent_b_id).where(Record.curing_agent_b_id.is_not(None))
        ).scalars()
    )

    stale_ids = db.execute(
        select(CuringAgent.id).where(CuringAgent.name.not_in(json_names))
    ).scalars()
    for ca_id in stale_ids:
        if ca_id in referenced_ids:
            continue
        db.execute(delete(CuringAgent).where(CuringAgent.id == ca_id))


def main() -> None:
    paths = default_paths()

    with SessionLocal() as db:
        upsert_process_types(db)
        upsert_materials(db, paths.materials_csv)
        db.commit()

    print("Seed complete.")


if __name__ == "__main__":
    main()
