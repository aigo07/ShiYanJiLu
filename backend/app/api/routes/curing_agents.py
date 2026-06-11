from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas.curing_agents import CuringAgentCreate, CuringAgentUpdate
from app.api.schemas.dicts import CuringAgentOut
from app.core.audit import emit_audit_event, model_to_dict
from app.core.database import get_db
from app.core.security import require_roles, require_write_roles
from app.models.curing_agent import CuringAgent
from app.models.material import Material
from app.models.record import Record


router = APIRouter()


def _get_or_404(db: Session, curing_agent_id: int) -> CuringAgent:
    ca = db.get(CuringAgent, curing_agent_id)
    if ca is None:
        raise HTTPException(status_code=404, detail="CuringAgent not found")
    return ca


def _validate_material_ids(db: Session, composition: list[dict] | None) -> None:
    if not composition:
        return
    ids = {int(x["material_id"]) for x in composition if "material_id" in x}
    if not ids:
        return
    existing = set(db.scalars(select(Material.id).where(Material.id.in_(ids))).all())
    missing = sorted(ids - existing)
    if missing:
        raise HTTPException(status_code=400, detail=f"composition material_id not found: {missing}")


@router.post("/curing-agents", response_model=CuringAgentOut)
def create_curing_agent(
    payload: CuringAgentCreate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> CuringAgent:
    comp = None
    if payload.composition is not None:
        comp = [x.model_dump() for x in payload.composition]
        _validate_material_ids(db, comp)

    ca = CuringAgent(
        name=payload.name,
        default_ratio=payload.default_ratio,
        status=payload.status,
        note=payload.note,
        composition=comp,
    )
    db.add(ca)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="CuringAgent name already exists")
    db.refresh(ca)
    emit_audit_event(
        db=db,
        request=request,
        action="curing_agent.create",
        entity_type="curing_agent",
        entity_id=str(ca.id),
        after_obj=ca,
    )
    db.commit()
    return ca


@router.get("/curing-agents", response_model=list[CuringAgentOut])
def list_curing_agents(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[CuringAgent]:
    stmt = (
        select(
            CuringAgent,
            func.count(Record.id).label("used_record_count"),
        )
        .outerjoin(
            Record,
            (Record.curing_agent_a_id == CuringAgent.id)
            | (Record.curing_agent_b_id == CuringAgent.id),
        )
        .group_by(CuringAgent.id)
        .order_by(CuringAgent.name)
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).all()
    out: list[CuringAgentOut] = []
    for ca, used_count in rows:
        out.append(CuringAgentOut.model_validate(ca).model_copy(update={"used_record_count": int(used_count or 0)}))
    return out


@router.get("/curing-agents/{curing_agent_id}", response_model=CuringAgentOut)
def get_curing_agent(
    curing_agent_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> CuringAgent:
    ca = _get_or_404(db, curing_agent_id)
    used_count = (
        db.scalar(
            select(func.count(Record.id)).where(
                (Record.curing_agent_a_id == curing_agent_id)
                | (Record.curing_agent_b_id == curing_agent_id)
            )
        )
        or 0
    )
    return CuringAgentOut.model_validate(ca).model_copy(update={"used_record_count": int(used_count)})


@router.patch("/curing-agents/{curing_agent_id}", response_model=CuringAgentOut)
def update_curing_agent(
    curing_agent_id: int,
    payload: CuringAgentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> CuringAgent:
    ca = _get_or_404(db, curing_agent_id)
    before = model_to_dict(ca)
    data = payload.model_dump(exclude_unset=True)

    if "composition" in data:
        # payload.composition is list[CompositionItem] | None.
        # Do NOT call model_dump() on dicts (payload.model_dump() already converts nested models).
        if payload.composition is None:
            ca.composition = None
        else:
            comp = [x.model_dump() for x in payload.composition]
            _validate_material_ids(db, comp)
            ca.composition = comp
        data.pop("composition", None)

    for k, v in data.items():
        setattr(ca, k, v)

    db.add(ca)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="CuringAgent name already exists")
    db.refresh(ca)
    emit_audit_event(
        db=db,
        request=request,
        action="curing_agent.update",
        entity_type="curing_agent",
        entity_id=str(ca.id),
        before_obj=before,
        after_obj=ca,
    )
    db.commit()
    return ca


@router.delete("/curing-agents/{curing_agent_id}")
def delete_curing_agent(
    curing_agent_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> dict[str, str]:
    ca = _get_or_404(db, curing_agent_id)
    before = model_to_dict(ca)
    db.delete(ca)
    try:
        emit_audit_event(
            db=db,
            request=request,
            action="curing_agent.delete",
            entity_type="curing_agent",
            entity_id=str(curing_agent_id),
            before_obj=before,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="CuringAgent is referenced by records")
    return {"status": "ok"}

