from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List, Optional, Any
from datetime import date, datetime
from database import database, models
import schemas

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
)


def _month_key(dt):
    return dt.strftime("%Y-%m")


def _month_label(month_key):
    months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    parts = month_key.split("-")
    if len(parts) != 2:
        return month_key
    try:
        year = parts[0]
        month_idx = int(parts[1]) - 1
        if 0 <= month_idx < 12:
            return f"{months[month_idx]} {year}"
    except Exception:
        pass
    return month_key


def _add_months(year, month, delta):
    total = year * 12 + (month - 1) + delta
    return total // 12, total % 12 + 1


def map_grade_to_standard(g_name: str, g_rank: int) -> str:
    if not g_name:
        return "RECHAZO"
    name_upper = g_name.upper().strip()
    if "RECH" in name_upper or "REJ" in name_upper:
        return "RECHAZO"
    if "COL" in name_upper:
        return "COL"
    if "COB" in name_upper:
        return "COB"
    if "COP" in name_upper:
        return "COP"
    
    if g_rank == 1:
        return "COL"
    elif g_rank == 2:
        return "COP"
    elif g_rank == 3:
        return "COB"
    else:
        return "RECHAZO"


@router.get("/global-stats")
def get_global_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    inspection_type: Optional[str] = None,
    market_id: Optional[int] = None,
    product_name: Optional[str] = None,
    origin: Optional[str] = None,
    thickness: Optional[str] = None,
    process: Optional[str] = None,
    area: Optional[str] = None,
    machine: Optional[str] = None,
    db: Session = Depends(database.get_db)
):
    # Consulta Base
    query = db.query(models.Inspection)

    # Filtros
    if start_date:
        query = query.filter(models.Inspection.date >= start_date)
    if end_date:
        query = query.filter(models.Inspection.date <= end_date)
    if inspection_type and inspection_type != 'all':
        query = query.filter(models.Inspection.type == inspection_type)
    if market_id:
        query = query.filter(models.Inspection.market_id == market_id)
    if product_name and product_name != 'all':
        query = query.filter(models.Inspection.product_name == product_name)
    if origin and origin != 'all':
        query = query.filter(models.Inspection.origin == origin)
    if thickness and thickness != 'all':
        query = query.filter(models.Inspection.thickness == thickness)
    if process and process != 'all':
        query = query.filter(models.Inspection.process == process)
    if area and area != 'all':
        query = query.filter(models.Inspection.area == area)
    if machine and machine != 'all':
        query = query.filter(models.Inspection.machine == machine)

    # Validar si existen datos para evitar procesamiento pesado en conjuntos vacíos
    total_count = query.count()
    if total_count == 0:
        return {
            "total_inspections": 0,
            "by_type": [],
            "by_market": [],
            "by_product": [],
            "defects_breakdown": [],
            "grade_breakdown": [],
            "trend_data": [],
            "grades_by_product": []
        }

    # -- Agregaciones --

    # 1. Por Tipo
    # Clonamos la consulta (o simplemente aplicamos filtros a una nueva consulta) para las agregaciones
    # Es más limpio reutilizar la lógica de filtrado.
    # Vamos a encapsular la aplicación de filtros.
    
    def apply_filters(q):
        if start_date: q = q.filter(models.Inspection.date >= start_date)
        if end_date: q = q.filter(models.Inspection.date <= end_date)
        if inspection_type and inspection_type != 'all': q = q.filter(models.Inspection.type == inspection_type)
        if market_id: q = q.filter(models.Inspection.market_id == market_id)
        if product_name and product_name != 'all': q = q.filter(models.Inspection.product_name == product_name)
        if origin and origin != 'all': q = q.filter(models.Inspection.origin == origin)
        if thickness and thickness != 'all': q = q.filter(models.Inspection.thickness == thickness)
        if process and process != 'all': q = q.filter(models.Inspection.process == process)
        if area and area != 'all': q = q.filter(models.Inspection.area == area)
        if machine and machine != 'all': q = q.filter(models.Inspection.machine == machine)
        return q

    # Estadísticas de Tipo
    q_type = apply_filters(db.query(models.Inspection.type, func.count(models.Inspection.id)).group_by(models.Inspection.type))
    by_type = [{"name": t, "value": c} for t, c in q_type.all()]

    # Estadísticas de Mercado (Join con Market para obtener el nombre)
    q_market = apply_filters(db.query(models.Market.name, func.count(models.Inspection.id)).join(models.Market).group_by(models.Market.name))
    by_market = [{"name": m, "value": c} for m, c in q_market.all()]

    # Estadísticas de Producto
    q_product = apply_filters(db.query(models.Inspection.product_name, func.count(models.Inspection.id)).group_by(models.Inspection.product_name))
    by_product = [{"name": p, "value": c} for p, c in q_product.all()]




    # -- Desgloses Detallados (Requiere Joins con InspectionResult) --
    
    # Joins comunes para resultados
    # Necesitamos filtrar los resultados basándonos en las inspecciones filtradas
    # Enfoque de Subconsulta o Join
    
    # Desglose de Grados
    q_grades = db.query(
        models.Grade.name,
        models.Grade.grade_rank,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.grade_id == models.Grade.id)\
     .join(models.Inspection, models.InspectionResult.inspection_id == models.Inspection.id)
    q_grades = apply_filters(q_grades).group_by(models.Grade.name, models.Grade.grade_rank).order_by(models.Grade.grade_rank.asc())
    grade_breakdown_dict = {}
    for g, g_rank, c in q_grades.all():
        if not g:
            continue
        g_clean = g.strip()
        grade_breakdown_dict[g_clean] = grade_breakdown_dict.get(g_clean, 0) + (c or 0)
    grade_breakdown = [{"name": g, "value": c} for g, c in grade_breakdown_dict.items()]

    # Desglose de Defectos (solo donde defect_id no es nulo)
    q_defects = db.query(models.Defect.name, func.sum(models.InspectionResult.pieces_count))\
        .join(models.InspectionResult, models.InspectionResult.defect_id == models.Defect.id)\
        .join(models.Inspection, models.InspectionResult.inspection_id == models.Inspection.id)
    q_defects = apply_filters(q_defects).group_by(models.Defect.name).order_by(func.sum(models.InspectionResult.pieces_count).desc())
    defects_breakdown = [{"name": d, "value": c or 0} for d, c in q_defects.all()]

    # Desglose de Defectos por Grado
    q_defects_by_grade = db.query(
        models.Grade.name,
        models.Grade.grade_rank,
        models.Defect.name,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.grade_id == models.Grade.id)\
     .join(models.Defect, models.InspectionResult.defect_id == models.Defect.id)\
     .join(models.Inspection, models.InspectionResult.inspection_id == models.Inspection.id)
    q_defects_by_grade = apply_filters(q_defects_by_grade).group_by(models.Grade.name, models.Grade.grade_rank, models.Defect.name)
    
    defects_by_grade = {}
    for g_name, g_rank, d_name, count in q_defects_by_grade.all():
        if not g_name:
            continue
        g_clean = g_name.strip()
        if g_clean not in defects_by_grade:
            defects_by_grade[g_clean] = {"total": 0, "defects": {}}
        defects_by_grade[g_clean]["defects"][d_name] = defects_by_grade[g_clean]["defects"].get(d_name, 0) + (count or 0)

    # También se necesita el total de piezas por grado para esta estructura (incluyendo piezas sin defectos)
    q_grade_totals = db.query(
        models.Grade.name,
        models.Grade.grade_rank,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.grade_id == models.Grade.id)\
     .join(models.Inspection, models.InspectionResult.inspection_id == models.Inspection.id)
    q_grade_totals = apply_filters(q_grade_totals).group_by(models.Grade.name, models.Grade.grade_rank)
    
    for g_name, g_rank, total in q_grade_totals.all():
        if not g_name:
            continue
        g_clean = g_name.strip()
        if g_clean not in defects_by_grade:
            defects_by_grade[g_clean] = {"total": 0, "defects": {}}
        defects_by_grade[g_clean]["total"] += total or 0

    # -- Datos de Tendencia --
    q_trend = db.query(
        models.Inspection.id,
        models.Inspection.date,
        models.Inspection.lot,
        models.Grade.name,
        models.Grade.grade_rank,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.inspection_id == models.Inspection.id)\
     .join(models.Grade, models.InspectionResult.grade_id == models.Grade.id)
    
    q_trend = apply_filters(q_trend).group_by(
        models.Inspection.id,
        models.Inspection.date,
        models.Inspection.lot,
        models.Grade.name,
        models.Grade.grade_rank
    ).order_by(models.Inspection.date.asc(), models.Inspection.id.asc())
    
    trend_rows = q_trend.all()
    
    trend_dict = {}
    for insp_id, insp_date, lot, grade_name, grade_rank, count in trend_rows:
        if insp_id not in trend_dict:
            trend_dict[insp_id] = {
                "id": insp_id,
                "date": insp_date.strftime("%Y-%m-%d") if insp_date else None,
                "lot": lot or "",
                "grades": {},
                "total": 0
            }
        g_clean = grade_name.strip() if grade_name else "RECHAZO"
        trend_dict[insp_id]["grades"][g_clean] = trend_dict[insp_id]["grades"].get(g_clean, 0) + (count or 0)
        trend_dict[insp_id]["total"] += count or 0
        
    trend_data = list(trend_dict.values())

    # -- Tendencia móvil de 12 meses --
    monthly_query = db.query(
        func.strftime("%Y-%m", models.Inspection.date).label("month_key"),
        func.sum(models.InspectionResult.pieces_count),
        func.sum(case((models.InspectionResult.defect_id.isnot(None), models.InspectionResult.pieces_count), else_=0))
    ).join(models.InspectionResult, models.InspectionResult.inspection_id == models.Inspection.id)
    monthly_query = apply_filters(monthly_query).group_by(func.strftime("%Y-%m", models.Inspection.date))

    monthly_rows = monthly_query.all()
    monthly_map = {}
    for month_key, total_pieces, defect_pieces in monthly_rows:
        if not month_key:
            continue
        monthly_map[month_key] = {
            "month_key": month_key,
            "label": _month_label(month_key),
            "total_pieces": int(total_pieces or 0),
            "defect_pieces": int(defect_pieces or 0),
        }

    today = datetime.now().date()
    year, month = today.year, today.month
    rolling_months = []
    for delta in range(-11, 1):
        y, m = _add_months(year, month, delta)
        rolling_months.append(f"{y:04d}-{m:02d}")

    trend_12m = []
    for month_key in rolling_months:
        row = monthly_map.get(month_key)
        if row:
            total_pieces = row["total_pieces"]
            defect_pieces = row["defect_pieces"]
            defect_rate = (defect_pieces / total_pieces * 100) if total_pieces else 0
            trend_12m.append({
                "month_key": month_key,
                "label": _month_label(month_key),
                "total_pieces": total_pieces,
                "defect_pieces": defect_pieces,
                "defect_rate": round(defect_rate, 2),
            })
        else:
            trend_12m.append({
                "month_key": month_key,
                "label": _month_label(month_key),
                "total_pieces": 0,
                "defect_pieces": 0,
                "defect_rate": 0,
            })

    # Desglose de Grados por Producto (para el gráfico de columnas apiladas)
    # Desglose de Grados por Producto (para el gráfico de columnas apiladas)
    q_prod_grades = db.query(
        models.Inspection.product_name,
        models.Grade.name,
        models.Grade.grade_rank,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.inspection_id == models.Inspection.id)\
     .join(models.Grade, models.InspectionResult.grade_id == models.Grade.id)
    
    q_prod_grades = apply_filters(q_prod_grades).group_by(
        models.Inspection.product_name,
        models.Grade.name,
        models.Grade.grade_rank
    )

    prod_grades_dict = {}
    for p_name, g_name, g_rank, count in q_prod_grades.all():
        if p_name not in prod_grades_dict:
            prod_grades_dict[p_name] = {
                "product": p_name or "General",
                "total": 0
            }
        g_clean = g_name.strip() if g_name else "RECHAZO"
        prod_grades_dict[p_name][g_clean] = prod_grades_dict[p_name].get(g_clean, 0) + (count or 0)
        prod_grades_dict[p_name]["total"] = prod_grades_dict[p_name].get("total", 0) + (count or 0)
    grades_by_product = list(prod_grades_dict.values())

    # Desglose de Grados por Producto y Mes (para el gráfico de columnas apiladas agrupadas)
    q_prod_month_grades = db.query(
        models.Inspection.product_name,
        func.strftime("%Y-%m", models.Inspection.date).label("month_key"),
        models.Grade.name,
        models.Grade.grade_rank,
        func.sum(models.InspectionResult.pieces_count)
    ).join(models.InspectionResult, models.InspectionResult.inspection_id == models.Inspection.id)\
     .join(models.Grade, models.InspectionResult.grade_id == models.Grade.id)
    
    q_prod_month_grades = apply_filters(q_prod_month_grades).group_by(
        models.Inspection.product_name,
        func.strftime("%Y-%m", models.Inspection.date),
        models.Grade.name,
        models.Grade.grade_rank
    ).order_by(
        models.Inspection.product_name.asc(),
        func.strftime("%Y-%m", models.Inspection.date).asc()
    )

    prod_month_grades_dict = {}
    for p_name, m_key, g_name, g_rank, count in q_prod_month_grades.all():
        if not m_key:
            continue
        key = (p_name, m_key)
        if key not in prod_month_grades_dict:
            month_lbl = _month_label(m_key)
            prod_month_grades_dict[key] = {
                "product": p_name or "General",
                "month_key": m_key,
                "month": month_lbl,
                "label": f"{p_name or 'General'}|{month_lbl}",
                "total": 0
            }
        g_clean = g_name.strip() if g_name else "RECHAZO"
        prod_month_grades_dict[key][g_clean] = prod_month_grades_dict[key].get(g_clean, 0) + (count or 0)
        prod_month_grades_dict[key]["total"] += count or 0
        
    grades_by_product_month = list(prod_month_grades_dict.values())

    return {
        "total_inspections": total_count,
        "by_type": by_type,
        "by_market": by_market,
        "by_product": by_product,
        "defects_breakdown": defects_breakdown,
        "grade_breakdown": grade_breakdown,
        "defects_by_grade": defects_by_grade,
        "trend_data": trend_data,
        "grades_by_product": grades_by_product,
        "grades_by_product_month": grades_by_product_month,
        "trend_12m": trend_12m
    }

@router.get("/truck-studies")
def get_truck_study_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(database.get_db)
):
    query = db.query(models.TruckStudy).options(joinedload(models.TruckStudy.defects))
    if start_date:
        query = query.filter(models.TruckStudy.reception_date >= start_date)
    if end_date:
        query = query.filter(models.TruckStudy.reception_date <= end_date)
    
    studies = query.all()
    if not studies:
        return {"total_logs": 0, "breakdown": []}

    total_logs = sum(s.total_logs for s in studies)
    
    # Agregar conteos por nombre de defecto
    defect_counts = {}
    for s in studies:
        for d in s.defects:
            defect_counts[d.defect_name] = defect_counts.get(d.defect_name, 0) + d.count
    
    # Formato para la respuesta
    breakdown = []
    for name, count in defect_counts.items():
        percentage = (count / total_logs * 100) if total_logs > 0 else 0
        breakdown.append({
            "name": name,
            "count": count,
            "percentage": round(percentage, 2)
        })
    
    # Ordenar por conteo descendente
    breakdown.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_logs": total_logs,
        "breakdown": breakdown
    }
