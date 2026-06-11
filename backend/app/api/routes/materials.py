from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.schemas.dicts import MaterialCreate, MaterialOut, MaterialUpdate
from app.core.audit import emit_audit_event, model_to_dict
from app.core.database import get_db
from app.core.security import require_roles, require_write_roles
from app.models.material import Material

router = APIRouter()


def _get_material_or_404(db: Session, material_id: int) -> Material:
    m = db.get(Material, material_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Material not found")
    return m


@router.post("/materials", response_model=MaterialOut)
def create_material(
    payload: MaterialCreate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Material:
    m = Material(**payload.model_dump())
    db.add(m)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="原材料已存在（类别+名称重复）")
    db.refresh(m)
    emit_audit_event(
        db=db,
        request=request,
        action="material.create",
        entity_type="material",
        entity_id=str(m.id),
        after_obj=m,
    )
    db.commit()
    return m


@router.patch("/materials/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: int,
    payload: MaterialUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> Material:
    m = _get_material_or_404(db, material_id)
    before = model_to_dict(m)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    db.add(m)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="更新失败：原材料已存在（类别+名称重复）")
    db.refresh(m)
    emit_audit_event(
        db=db,
        request=request,
        action="material.update",
        entity_type="material",
        entity_id=str(m.id),
        before_obj=before,
        after_obj=m,
    )
    db.commit()
    return m


@router.delete("/materials/{material_id}")
def delete_material(
    material_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _user=Depends(require_write_roles("admin", "editor")),
) -> dict[str, str]:
    m = _get_material_or_404(db, material_id)
    before = model_to_dict(m)
    db.delete(m)
    try:
        emit_audit_event(
            db=db,
            request=request,
            action="material.delete",
            entity_type="material",
            entity_id=str(material_id),
            before_obj=before,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="删除失败：该原材料已被引用，不能删除。")
    return {"status": "ok"}


@router.get("/materials/{material_id}", response_model=MaterialOut)
def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> Material:
    return _get_material_or_404(db, material_id)

