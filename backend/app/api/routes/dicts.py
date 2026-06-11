from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.schemas.dicts import ExperimentSuggestionsOut, MaterialOut, ProcessTypeOut
from app.core.database import get_db
from app.core.security import require_roles
from app.models.experiment import Experiment
from app.models.material import Material
from app.models.process_type import ProcessType


router = APIRouter()


@router.get("/process-types", response_model=list[ProcessTypeOut])
def list_process_types(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[ProcessType]:
    return list(db.scalars(select(ProcessType).order_by(ProcessType.name)).all())


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> list[Material]:
    stmt = select(Material).order_by(Material.category, Material.name).limit(limit).offset(offset)
    return list(db.scalars(stmt).all())


@router.get("/experiment-suggestions", response_model=ExperimentSuggestionsOut)
def get_experiment_suggestions(
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> dict[str, list[str]]:
    customers_stmt = (
        select(Experiment.customer_name, func.count().label("n"))
        .where(Experiment.customer_name.is_not(None))
        .where(func.length(func.trim(Experiment.customer_name)) > 0)
        .group_by(Experiment.customer_name)
        .order_by(func.count().desc(), Experiment.customer_name.asc())
        .limit(limit)
    )
    models_stmt = (
        select(Experiment.silicone_model, func.count().label("n"))
        .where(Experiment.silicone_model.is_not(None))
        .where(func.length(func.trim(Experiment.silicone_model)) > 0)
        .group_by(Experiment.silicone_model)
        .order_by(func.count().desc(), Experiment.silicone_model.asc())
        .limit(limit)
    )

    customers = [row[0] for row in db.execute(customers_stmt).all()]
    silicone_models = [row[0] for row in db.execute(models_stmt).all()]

    OTHER = "其它"
    if OTHER not in customers:
        customers.append(OTHER)
    if OTHER not in silicone_models:
        silicone_models.append(OTHER)

    return {"customers": customers, "silicone_models": silicone_models}


