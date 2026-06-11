from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.schemas.experiments import (
    ExperimentCreate,
    ExperimentOut,
    ExperimentOutWithRecords,
    ExperimentUpdate,
)
from app.api.schemas.records import RecordOut
from app.core.audit import emit_audit_event, model_to_dict
from app.core.database import get_db
from app.core.security import require_roles, require_write_roles
from app.models.experiment import Experiment
from app.models.process_type import ProcessType
from app.models.record import Record


router = APIRouter()


def _get_experiment_or_404(db: Session, experiment_id: int) -> Experiment:
    exp = db.get(Experiment, experiment_id)
    if exp is None:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return exp


def _assert_process_type_exists(db: Session, process_type_id: int) -> None:
    if db.get(ProcessType, process_type_id) is None:
        raise HTTPException(status_code=400, detail="process_type_id not found")


@router.post("/experiments", response_model=ExperimentOut)
def create_experiment(
    payload: ExperimentCreate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Experiment:
    _assert_process_type_exists(db, payload.process_type_id)
    data = payload.model_dump()
    # end_at semantics: only ended experiments have end_at
    if data.get("status") == "已结束":
        # If end_at is missing/empty, or a legacy default equal to start_at, treat as not provided.
        if data.get("end_at") is None or data.get("end_at") == data.get("start_at"):
            data["end_at"] = datetime.now(timezone.utc)
    else:
        data["end_at"] = None
    exp = Experiment(**data)
    db.add(exp)
    # audit (id generated after flush/commit; ok to fill after refresh)
    db.commit()
    db.refresh(exp)
    emit_audit_event(
        db=db,
        request=request,
        action="experiment.create",
        entity_type="experiment",
        entity_id=str(exp.id),
        after_obj=exp,
    )
    db.commit()
    return exp


@router.get("/experiments", response_model=list[ExperimentOut])
def list_experiments(
    process_type_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    curing_agent_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[Experiment]:
    stmt = select(Experiment)
    if q is not None and q.strip():
        pat = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Experiment.customer_name.ilike(pat),
                Experiment.project_no.ilike(pat),
                Experiment.silicone_model.ilike(pat),
            )
        )
    if process_type_id is not None:
        stmt = stmt.where(Experiment.process_type_id == process_type_id)
    if status is not None:
        stmt = stmt.where(Experiment.status == status)
    if curing_agent_id is not None:
        exp_ids_stmt = (
            select(Record.experiment_id)
            .where(
                or_(
                    Record.curing_agent_a_id == curing_agent_id,
                    Record.curing_agent_b_id == curing_agent_id,
                )
            )
            .distinct()
        )
        stmt = stmt.where(Experiment.id.in_(exp_ids_stmt))
    stmt = stmt.order_by(Experiment.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).all())


@router.get("/experiments/{experiment_id}", response_model=ExperimentOut | ExperimentOutWithRecords)
def get_experiment(
    experiment_id: int,
    include_records: bool = Query(False),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> Experiment:
    if include_records:
        stmt = (
            select(Experiment)
            .where(Experiment.id == experiment_id)
            .options(joinedload(Experiment.records))
        )
        exp = db.scalars(stmt).unique().one_or_none()
        if exp is None:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return exp

    return _get_experiment_or_404(db, experiment_id)


@router.get("/experiments/{experiment_id}/records", response_model=list[RecordOut])
def list_records_for_experiment(
    experiment_id: int,
    process_type_id: int | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[Record]:
    # Ensure experiment exists (clean 404 rather than empty list for typo IDs)
    _get_experiment_or_404(db, experiment_id)

    stmt = select(Record).where(Record.experiment_id == experiment_id)
    if process_type_id is not None:
        stmt = stmt.join(Experiment, Experiment.id == Record.experiment_id).where(
            func.coalesce(Record.process_type_id, Experiment.process_type_id) == process_type_id
        )
    stmt = stmt.order_by(Record.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).all())


@router.patch("/experiments/{experiment_id}", response_model=ExperimentOut)
def update_experiment(
    experiment_id: int,
    payload: ExperimentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Experiment:
    exp = _get_experiment_or_404(db, experiment_id)
    before = model_to_dict(exp)
    data = payload.model_dump(exclude_unset=True)

    if "process_type_id" in data:
        if data["process_type_id"] is None:
            raise HTTPException(status_code=400, detail="process_type_id is required")
        _assert_process_type_exists(db, data["process_type_id"])

    # end_at semantics: only ended experiments have end_at
    if "status" in data:
        if data["status"] == "已结束":
            # allow user-supplied end_at; otherwise auto-now
            # If end_at is missing/empty, or a legacy default equal to start_at, treat as not provided.
            if data.get("end_at") is None or data.get("end_at") == exp.start_at:
                data["end_at"] = datetime.now(timezone.utc)
        else:
            # re-activated: clear end_at
            data["end_at"] = None

    for k, v in data.items():
        setattr(exp, k, v)
    db.add(exp)
    db.commit()
    db.refresh(exp)
    emit_audit_event(
        db=db,
        request=request,
        action="experiment.update",
        entity_type="experiment",
        entity_id=str(exp.id),
        before_obj=before,
        after_obj=exp,
    )
    db.commit()
    return exp


@router.delete("/experiments/{experiment_id}")
def delete_experiment(
    experiment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> dict[str, str]:
    exp = _get_experiment_or_404(db, experiment_id)
    before = model_to_dict(exp)
    try:
        # Break the Experiment -> Record circular FK before cascading deletes run.
        # Otherwise deleting records first can violate experiments.final_record_id FK.
        exp.final_record_id = None
        db.flush()

        db.delete(exp)
        emit_audit_event(
            db=db,
            request=request,
            action="experiment.delete",
            entity_type="experiment",
            entity_id=str(experiment_id),
            before_obj=before,
        )
        db.commit()
        return {"status": "ok"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="删除失败：该实验存在关联数据，无法删除。")

