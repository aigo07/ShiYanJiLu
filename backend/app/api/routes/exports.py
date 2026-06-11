from __future__ import annotations

import csv
import io
from datetime import datetime
from urllib.parse import quote
import zipfile

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.database import get_db
from app.core.security import require_roles
from app.models.curing_agent import CuringAgent
from app.models.experiment import Experiment
from app.models.record import Record

router = APIRouter()


def _fmt_dt(dt: datetime | None) -> str:
    if dt is None:
        return ""
    # ISO8601 is easiest for Excel parsing too
    return dt.isoformat()


@router.get("/exports/records.csv")
def export_records_csv(
    # filters
    experiment_id: int | None = Query(default=None),
    process_type_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    curing_agent_id: int | None = Query(default=None),
    customer_q: str | None = Query(default=None, description="客户名包含（不区分大小写）"),
    silicone_model_q: str | None = Query(default=None, description="硅胶型号包含（不区分大小写）"),
    project_no_q: str | None = Query(default=None, description="项目号包含（不区分大小写）"),
    start_from: datetime | None = Query(default=None, description="实验开始时间 >= start_from"),
    start_to: datetime | None = Query(default=None, description="实验开始时间 <= start_to"),
    only_final: bool = Query(default=False, description="仅导出最终记录"),
    limit: int = Query(2000, ge=1, le=20000),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> StreamingResponse:
    ca_b = aliased(CuringAgent)
    ca_a = aliased(CuringAgent)
    # process type comes from record.process_type_id fallback to experiment.process_type_id
    from app.models.process_type import ProcessType  # avoid circular import patterns elsewhere

    pt = aliased(ProcessType)

    stmt = (
        select(
            Record,
            Experiment,
            pt.name.label("process_type_name"),
            ca_a.name.label("ca_a_name"),
            ca_b.name.label("ca_b_name"),
        )
        .join(Experiment, Experiment.id == Record.experiment_id)
        .outerjoin(pt, pt.id == func.coalesce(Record.process_type_id, Experiment.process_type_id))
        .join(ca_a, ca_a.id == Record.curing_agent_a_id)
        .join(ca_b, ca_b.id == Record.curing_agent_b_id)
    )

    if experiment_id is not None:
        stmt = stmt.where(Record.experiment_id == experiment_id)
    if process_type_id is not None:
        stmt = stmt.where(func.coalesce(Record.process_type_id, Experiment.process_type_id) == process_type_id)
    if status is not None:
        stmt = stmt.where(Experiment.status == status)
    if curing_agent_id is not None:
        stmt = stmt.where(
            or_(
                Record.curing_agent_a_id == curing_agent_id,
                Record.curing_agent_b_id == curing_agent_id,
            )
        )
    if customer_q:
        stmt = stmt.where(Experiment.customer_name.ilike(f"%{customer_q.strip()}%"))
    if silicone_model_q:
        stmt = stmt.where(Experiment.silicone_model.ilike(f"%{silicone_model_q.strip()}%"))
    if project_no_q:
        stmt = stmt.where(Experiment.project_no.ilike(f"%{project_no_q.strip()}%"))
    if start_from is not None:
        stmt = stmt.where(Experiment.start_at >= start_from)
    if start_to is not None:
        stmt = stmt.where(Experiment.start_at <= start_to)
    if only_final:
        stmt = stmt.where(Experiment.final_record_id == Record.id)

    stmt = stmt.order_by(Record.id.desc()).limit(limit)

    rows = db.execute(stmt).all()

    # Build CSV in memory. For MVP size (<=20k) this is fine.
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    header = [
        # record
        "记录ID",
        "实验ID",
        "工艺类型ID（生效）",
        "工艺类型",
        "是否最终",
        "硫化剂A_ID",
        "硫化剂A",
        "A比例（%）",
        "硫化剂B_ID",
        "硫化剂B",
        "B比例（%）",
        "ML",
        "MH",
        "T10（秒）",
        "T90（秒）",
        "气泡等级",
        "记录备注",
        "记录创建时间",
        "记录更新时间",
        # experiment expanded
        "客户",
        "项目号",
        "硅胶型号",
        "调试目标",
        "实验开始时间",
        "实验结束时间",
        "实验备注",
        "实验创建时间",
        "实验更新时间",
    ]
    writer.writerow(header)

    for rec, exp, process_type_name, ca_a_name, ca_b_name in rows:
        effective_pt_id = rec.process_type_id if rec.process_type_id is not None else exp.process_type_id
        is_final = 1 if exp.final_record_id == rec.id else 0

        writer.writerow(
            [
                rec.id,
                rec.experiment_id,
                effective_pt_id if effective_pt_id is not None else "",
                process_type_name or "",
                is_final,
                rec.curing_agent_a_id,
                ca_a_name or "",
                rec.ratio_a_pct,
                rec.curing_agent_b_id,
                ca_b_name or "",
                rec.ratio_b_pct,
                rec.ml,
                rec.mh,
                rec.t10_sec,
                rec.t90_sec,
                rec.bubble_grade,
                rec.note or "",
                _fmt_dt(rec.created_at),
                _fmt_dt(rec.updated_at),
                exp.customer_name,
                exp.project_no,
                exp.silicone_model,
                exp.debug_goal or "",
                _fmt_dt(exp.start_at),
                _fmt_dt(exp.end_at),
                exp.note or "",
                _fmt_dt(exp.created_at),
                _fmt_dt(exp.updated_at),
            ]
        )

    data = buf.getvalue()
    buf.close()

    # Excel-friendly UTF-8 with BOM
    out = ("\ufeff" + data).encode("utf-8")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename_cn = f"记录导出_{ts}.csv"
    # RFC5987 UTF-8 filename* (Chinese filename)
    # NOTE: If some client ignores filename*, it will still download but may use a fallback name.
    content_disposition = f"attachment; filename=\"TEST123.csv\"; filename*=UTF-8''{quote(filename_cn)}"
    return StreamingResponse(
        io.BytesIO(out),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": content_disposition, "X-Export-Debug": "from_new_code"},
    )


@router.get("/exports/experiments_records.zip")
def export_experiments_and_records_zip(
    process_type_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    curing_agent_id: int | None = Query(default=None),
    customer_q: str | None = Query(default=None, description="客户名包含（不区分大小写）"),
    silicone_model_q: str | None = Query(default=None, description="硅胶型号包含（不区分大小写）"),
    project_no_q: str | None = Query(default=None, description="项目号包含（不区分大小写）"),
    start_from: datetime | None = Query(default=None, description="实验开始时间 >= start_from"),
    start_to: datetime | None = Query(default=None, description="实验开始时间 <= start_to"),
    only_final: bool = Query(default=False, description="仅导出最终记录"),
    limit: int = Query(5000, ge=1, le=20000, description="最多导出多少条记录（不是实验数）"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "auditor", "editor", "viewer")),
) -> StreamingResponse:
    from app.models.process_type import ProcessType

    pt = aliased(ProcessType)
    ca_a = aliased(CuringAgent)
    ca_b = aliased(CuringAgent)

    # 1) export experiment list (matching filters)
    exp_stmt = (
        select(
            Experiment,
            pt.name.label("process_type_name"),
        )
        .outerjoin(pt, pt.id == Experiment.process_type_id)
    )
    if process_type_id is not None:
        exp_stmt = exp_stmt.where(Experiment.process_type_id == process_type_id)
    if status is not None:
        exp_stmt = exp_stmt.where(Experiment.status == status)
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
        exp_stmt = exp_stmt.where(Experiment.id.in_(exp_ids_stmt))
    if customer_q:
        exp_stmt = exp_stmt.where(Experiment.customer_name.ilike(f"%{customer_q.strip()}%"))
    if silicone_model_q:
        exp_stmt = exp_stmt.where(Experiment.silicone_model.ilike(f"%{silicone_model_q.strip()}%"))
    if project_no_q:
        exp_stmt = exp_stmt.where(Experiment.project_no.ilike(f"%{project_no_q.strip()}%"))
    if start_from is not None:
        exp_stmt = exp_stmt.where(Experiment.start_at >= start_from)
    if start_to is not None:
        exp_stmt = exp_stmt.where(Experiment.start_at <= start_to)
    exp_stmt = exp_stmt.order_by(Experiment.id.desc())
    exp_rows = db.execute(exp_stmt).all()

    exp_buf = io.StringIO()
    exp_writer = csv.writer(exp_buf, lineterminator="\n")
    exp_writer.writerow(
        [
            "实验ID",
            "客户",
            "项目号",
            "硅胶型号",
            "调试目标",
            "工艺类型ID",
            "工艺类型",
            "开始时间",
            "结束时间",
            "备注",
            "创建时间",
            "更新时间",
        ]
    )
    exp_ids: list[int] = []
    for exp, pt_name in exp_rows:
        exp_ids.append(exp.id)
        exp_writer.writerow(
            [
                exp.id,
                exp.customer_name,
                exp.project_no,
                exp.silicone_model,
                exp.debug_goal or "",
                exp.process_type_id if exp.process_type_id is not None else "",
                pt_name or "",
                _fmt_dt(exp.start_at),
                _fmt_dt(exp.end_at),
                exp.note or "",
                _fmt_dt(exp.created_at),
                _fmt_dt(exp.updated_at),
            ]
        )
    exp_csv_bytes = ("\ufeff" + exp_buf.getvalue()).encode("utf-8")
    exp_buf.close()

    # 2) export record detail, with experiment columns repeated to avoid ID-joining
    rec_stmt = (
        select(
            Record,
            Experiment,
            pt.name.label("process_type_name_effective"),
            ca_a.name.label("ca_a_name"),
            ca_b.name.label("ca_b_name"),
        )
        .join(Experiment, Experiment.id == Record.experiment_id)
        .outerjoin(pt, pt.id == func.coalesce(Record.process_type_id, Experiment.process_type_id))
        .join(ca_a, ca_a.id == Record.curing_agent_a_id)
        .join(ca_b, ca_b.id == Record.curing_agent_b_id)
        .where(Record.experiment_id.in_(exp_ids) if exp_ids else False)
    )
    if process_type_id is not None:
        rec_stmt = rec_stmt.where(func.coalesce(Record.process_type_id, Experiment.process_type_id) == process_type_id)
    if status is not None:
        rec_stmt = rec_stmt.where(Experiment.status == status)
    if curing_agent_id is not None:
        rec_stmt = rec_stmt.where(
            or_(
                Record.curing_agent_a_id == curing_agent_id,
                Record.curing_agent_b_id == curing_agent_id,
            )
        )
    if only_final:
        rec_stmt = rec_stmt.where(Experiment.final_record_id == Record.id)
    # Group-friendly ordering: by experiment desc, final first, then record desc
    rec_stmt = rec_stmt.order_by(
        Experiment.id.desc(),
        (Experiment.final_record_id == Record.id).desc(),
        Record.id.desc(),
    ).limit(limit)
    rec_rows = db.execute(rec_stmt).all()

    rec_buf = io.StringIO()
    rec_writer = csv.writer(rec_buf, lineterminator="\n")
    rec_writer.writerow(
        [
            # experiment (repeated)
            "客户",
            "项目号",
            "硅胶型号",
            "实验开始时间",
            "实验结束时间",
            "工艺类型（实验）",
            # record
            "记录ID",
            "是否最终",
            "工艺类型（生效）",
            "硫化剂A",
            "A比例（%）",
            "硫化剂B",
            "B比例（%）",
            "ML",
            "MH",
            "T10（秒）",
            "T90（秒）",
            "气泡等级",
            "记录备注",
            "记录创建时间",
            "记录更新时间",
        ]
    )
    for rec, exp, pt_eff_name, ca_a_name, ca_b_name in rec_rows:
        is_final = 1 if exp.final_record_id == rec.id else 0
        exp_pt_name = ""
        if exp.process_type_id is not None:
            # reuse exp_rows mapping would be faster, but MVP ok
            exp_pt_name = (
                db.scalar(select(ProcessType.name).where(ProcessType.id == exp.process_type_id)) or ""
            )
        rec_writer.writerow(
            [
                exp.customer_name,
                exp.project_no,
                exp.silicone_model,
                _fmt_dt(exp.start_at),
                _fmt_dt(exp.end_at),
                exp_pt_name,
                rec.id,
                is_final,
                pt_eff_name or "",
                ca_a_name or "",
                rec.ratio_a_pct,
                ca_b_name or "",
                rec.ratio_b_pct,
                rec.ml,
                rec.mh,
                rec.t10_sec,
                rec.t90_sec,
                rec.bubble_grade,
                rec.note or "",
                _fmt_dt(rec.created_at),
                _fmt_dt(rec.updated_at),
            ]
        )
    rec_csv_bytes = ("\ufeff" + rec_buf.getvalue()).encode("utf-8")
    rec_buf.close()

    # 3) pack zip
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("实验_列表.csv", exp_csv_bytes)
        z.writestr("实验_记录明细.csv", rec_csv_bytes)
    zbuf.seek(0)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename_cn = f"实验+记录导出_{ts}.zip"
    content_disposition = f"attachment; filename*=UTF-8''{quote(filename_cn)}"
    return StreamingResponse(
        zbuf,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition},
    )

