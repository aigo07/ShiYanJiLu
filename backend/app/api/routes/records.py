from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas.records import RecordCreate, RecordOut, RecordUpdate
from app.core.audit import emit_audit_event, model_to_dict
from app.core.database import get_db
from app.core.security import require_roles, require_write_roles
from app.models.curing_agent import CuringAgent
from app.models.experiment import Experiment
from app.models.process_type import ProcessType
from app.models.record import Record


router = APIRouter()


def _get_record_or_404(db: Session, record_id: int) -> Record:
    r = db.get(Record, record_id)
    if r is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return r


def _assert_fk_exists(db: Session, model: type, obj_id: int, field: str) -> None:
    if db.get(model, obj_id) is None:
        raise HTTPException(status_code=400, detail=f"{field} not found")


@router.post("/records", response_model=RecordOut)
def create_record(
    payload: RecordCreate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Record:
    exp = db.get(Experiment, payload.experiment_id)
    if exp is None:
        raise HTTPException(status_code=400, detail="experiment_id not found")
    _assert_fk_exists(db, CuringAgent, payload.curing_agent_a_id, "curing_agent_a_id")
    _assert_fk_exists(db, CuringAgent, payload.curing_agent_b_id, "curing_agent_b_id")
    if payload.process_type_id is not None:
        _assert_fk_exists(db, ProcessType, payload.process_type_id, "process_type_id")

    r = Record(**payload.model_dump())
    db.add(r)
    # Auto-start: once a record is created, the experiment is considered started.
    if exp.status == "待开始":
        exp.status = "进行中"
        db.add(exp)
    db.commit()
    db.refresh(r)
    emit_audit_event(
        db=db,
        request=request,
        action="record.create",
        entity_type="record",
        entity_id=str(r.id),
        after_obj=r,
    )
    db.commit()
    return r


@router.get("/records", response_model=list[RecordOut])
def list_records(
    process_type_id: int | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[Record]:
    stmt = select(Record)
    if process_type_id is not None:
        stmt = stmt.join(Experiment, Experiment.id == Record.experiment_id).where(
            func.coalesce(Record.process_type_id, Experiment.process_type_id) == process_type_id
        )
    stmt = stmt.order_by(Record.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).all())


@router.get("/records/{record_id}", response_model=RecordOut)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> Record:
    return _get_record_or_404(db, record_id)


@router.patch("/records/{record_id}", response_model=RecordOut)
def update_record(
    record_id: int,
    payload: RecordUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Record:
    r = _get_record_or_404(db, record_id)
    before = model_to_dict(r)
    data = payload.model_dump(exclude_unset=True)

    if "experiment_id" in data:
        _assert_fk_exists(db, Experiment, data["experiment_id"], "experiment_id")
    if "curing_agent_a_id" in data:
        _assert_fk_exists(db, CuringAgent, data["curing_agent_a_id"], "curing_agent_a_id")
    if "curing_agent_b_id" in data:
        _assert_fk_exists(db, CuringAgent, data["curing_agent_b_id"], "curing_agent_b_id")
    if "process_type_id" in data and data["process_type_id"] is not None:
        _assert_fk_exists(db, ProcessType, data["process_type_id"], "process_type_id")

    # Validate ratio sum if a patch sets one ratio but not the other.
    if ("ratio_a_pct" in data) ^ ("ratio_b_pct" in data):
        ra = data.get("ratio_a_pct", r.ratio_a_pct)
        rb = data.get("ratio_b_pct", r.ratio_b_pct)
        if (ra + rb) >= 100:
            raise HTTPException(status_code=400, detail="ratio_a_pct + ratio_b_pct must be < 100")

    for k, v in data.items():
        setattr(r, k, v)

    db.add(r)
    db.commit()
    db.refresh(r)
    emit_audit_event(
        db=db,
        request=request,
        action="record.update",
        entity_type="record",
        entity_id=str(r.id),
        before_obj=before,
        after_obj=r,
    )
    db.commit()
    return r


@router.delete("/records/{record_id}")
def delete_record(
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> dict[str, str]:
    r = _get_record_or_404(db, record_id)
    before = model_to_dict(r)
    db.delete(r)
    emit_audit_event(
        db=db,
        request=request,
        action="record.delete",
        entity_type="record",
        entity_id=str(record_id),
        before_obj=before,
    )
    db.commit()
    return {"status": "ok"}

