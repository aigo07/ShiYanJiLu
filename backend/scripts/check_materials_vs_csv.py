from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.material import Material


CSV_TO_DB_FIELDS: dict[str, str] = {
    "含氢量": "hydrogen_content",
    "乙烯基含量": "vinyl_content",
    "挥发分min": "volatile_min",
    "挥发分max": "volatile_max",
    "平均分子量(万)": "avg_mw_wan",
    "铂含量(ppm)": "pt_ppm",
}


def _parse_float(s: Any) -> float | None:
    if s is None:
        return None
    s = str(s).strip()
    if s == "":
        return None
    return float(s)


def _float_equal(a: float | None, b: float | None, *, atol: float) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if math.isfinite(a) and math.isfinite(b):
        return abs(a - b) <= atol
    return a == b


@dataclass(frozen=True)
class MaterialRow:
    category: str
    name: str
    numeric: dict[str, float | None]

    @property
    def key(self) -> tuple[str, str]:
        return (self.category, self.name)


def read_csv_materials(csv_path: Path) -> dict[tuple[str, str], MaterialRow]:
    if not csv_path.exists():
        raise FileNotFoundError(str(csv_path))

    out: dict[tuple[str, str], MaterialRow] = {}
    duplicates: list[tuple[str, str]] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            category = (r.get("分类") or "").strip()
            name = (r.get("对外型号") or "").strip()
            if not category or not name:
                continue

            numeric: dict[str, float | None] = {}
            for csv_col, db_col in CSV_TO_DB_FIELDS.items():
                numeric[db_col] = _parse_float(r.get(csv_col))

            row = MaterialRow(category=category, name=name, numeric=numeric)
            if row.key in out:
                duplicates.append(row.key)
            out[row.key] = row

    if duplicates:
        dup_preview = ", ".join([f"{c}::{n}" for (c, n) in duplicates[:10]])
        raise ValueError(
            f"CSV has duplicate (分类,对外型号) keys, first 10: {dup_preview}"
        )

    return out


def read_db_materials() -> dict[tuple[str, str], MaterialRow]:
    out: dict[tuple[str, str], MaterialRow] = {}
    duplicates: list[tuple[str, str]] = []

    with SessionLocal() as db:
        rows = db.execute(select(Material)).scalars().all()

    for m in rows:
        category = str(m.category).strip()
        name = str(m.name).strip()
        numeric = {col: getattr(m, col) for col in CSV_TO_DB_FIELDS.values()}
        row = MaterialRow(category=category, name=name, numeric=numeric)
        if row.key in out:
            duplicates.append(row.key)
        out[row.key] = row

    if duplicates:
        dup_preview = ", ".join([f"{c}::{n}" for (c, n) in duplicates[:10]])
        raise RuntimeError(
            "DB has duplicate (category,name) keys (unique constraint may be missing). "
            f"First 10: {dup_preview}"
        )

    return out


def compare(
    *,
    csv_map: dict[tuple[str, str], MaterialRow],
    db_map: dict[tuple[str, str], MaterialRow],
    atol: float,
) -> dict[str, Any]:
    csv_keys = set(csv_map.keys())
    db_keys = set(db_map.keys())

    missing_in_db = sorted(csv_keys - db_keys)
    extra_in_db = sorted(db_keys - csv_keys)

    mismatches: list[dict[str, Any]] = []
    common_keys = sorted(csv_keys & db_keys)
    for k in common_keys:
        c = csv_map[k]
        d = db_map[k]

        diff_fields: dict[str, dict[str, Any]] = {}
        for col in CSV_TO_DB_FIELDS.values():
            cv = c.numeric.get(col)
            dv = d.numeric.get(col)
            if not _float_equal(cv, dv, atol=atol):
                diff_fields[col] = {"csv": cv, "db": dv}

        if diff_fields:
            mismatches.append(
                {
                    "category": k[0],
                    "name": k[1],
                    "diff": diff_fields,
                }
            )

    return {
        "summary": {
            "csv_count": len(csv_keys),
            "db_count": len(db_keys),
            "missing_in_db_count": len(missing_in_db),
            "extra_in_db_count": len(extra_in_db),
            "mismatch_count": len(mismatches),
            "float_atol": atol,
        },
        "missing_in_db": [{"category": c, "name": n} for (c, n) in missing_in_db],
        "extra_in_db": [{"category": c, "name": n} for (c, n) in extra_in_db],
        "field_mismatches": mismatches,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only check: compare materials in DB vs basic_materials.csv"
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(r"c:\NotOneDrive\Other\DataAndAlgo\data\reference\basic_materials.csv"),
        help="Path to basic_materials.csv",
    )
    parser.add_argument(
        "--atol",
        type=float,
        default=1e-9,
        help="Absolute tolerance for float comparisons",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Optional path to write JSON report",
    )
    args = parser.parse_args()

    csv_map = read_csv_materials(args.csv)
    db_map = read_db_materials()

    report = compare(csv_map=csv_map, db_map=db_map, atol=args.atol)
    summary = report["summary"]

    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if args.report is not None:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote report: {args.report}")

    # Exit non-zero if not consistent.
    if (
        summary["missing_in_db_count"] == 0
        and summary["extra_in_db_count"] == 0
        and summary["mismatch_count"] == 0
    ):
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

