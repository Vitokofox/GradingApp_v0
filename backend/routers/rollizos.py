from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import database, models
from routers.auth import get_current_active_user, get_current_admin_user
from services.rollizos_service import SOURCE_SHEET, normalize_row, read_source, save_upload


router = APIRouter(prefix="/api/rollizos", tags=["Datos Antigüedad"])
MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
PIVOT_WOOD_STATES = ("FRESCA", "QUEMADA", "QUEMADA 2")


def _record_filters(query, year=None, month=None, product_length=None, destination=None, origin=None, zone=None, wood_state=None, age_bucket=None):
    if year:
        query = query.filter(models.DatosAntiguedad.year == year)
    if month:
        query = query.filter(models.DatosAntiguedad.month_number == month)
    if product_length:
        query = query.filter(models.DatosAntiguedad.product_length == product_length)
    if destination:
        query = query.filter(models.DatosAntiguedad.destination == destination)
    if origin:
        query = query.filter(models.DatosAntiguedad.origin == origin)
    if zone:
        query = query.filter(models.DatosAntiguedad.zone == zone)
    if wood_state:
        query = query.filter(models.DatosAntiguedad.wood_state == wood_state)
    if age_bucket:
        query = query.filter(models.DatosAntiguedad.age_bucket == age_bucket)
    return query


def _month_label(number, fallback=""):
    try:
        index = int(number) - 1
        return MONTHS[index] if 0 <= index < 12 else fallback
    except (TypeError, ValueError):
        return fallback


def _base_filters_kwargs(year, month, product_length, destination, origin, zone, wood_state, age_bucket):
    return dict(
        year=year,
        month=month,
        product_length=product_length,
        destination=destination,
        origin=origin,
        zone=zone,
        wood_state=wood_state,
        age_bucket=age_bucket,
    )


@router.post("/imports", dependencies=[Depends(get_current_admin_user)])
async def import_datos_antiguedad(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Debe cargar un archivo Excel .xlsx o .xlsm.")

    temp_path, digest = save_upload(file)
    batch = models.RollizosImport(filename=file.filename, file_hash=digest, source_sheet=SOURCE_SHEET)
    db.add(batch)
    db.commit()
    db.refresh(batch)

    seen_keys = set()
    candidates = []
    try:
        for raw in read_source(temp_path):
            batch.rows_read += 1
            normalized = normalize_row(raw)
            if normalized is None:
                batch.invalid_rows += 1
                continue
            key = normalized["business_key"]
            if key in seen_keys:
                batch.duplicates_skipped += 1
                continue
            seen_keys.add(key)
            candidates.append(normalized)

        existing_keys = set()
        candidate_keys = [item["business_key"] for item in candidates]
        for offset in range(0, len(candidate_keys), 500):
            chunk = candidate_keys[offset:offset + 500]
            existing_keys.update(
                key for (key,) in db.query(models.DatosAntiguedad.business_key)
                .filter(models.DatosAntiguedad.business_key.in_(chunk)).all()
            )

        unique_rows = [item for item in candidates if item["business_key"] not in existing_keys]
        batch.duplicates_skipped += len(candidates) - len(unique_rows)
        db.bulk_insert_mappings(
            models.DatosAntiguedad,
            [dict(item, import_id=batch.id) for item in unique_rows],
        )
        batch.rows_inserted = len(unique_rows)
        batch.status = "completed"
        db.commit()
        return {
            "import_id": batch.id,
            "source_sheet": SOURCE_SHEET,
            "rows_read": batch.rows_read,
            "rows_inserted": batch.rows_inserted,
            "duplicates_skipped": batch.duplicates_skipped,
            "invalid_rows": batch.invalid_rows,
            "status": batch.status,
        }
    except Exception as exc:
        db.rollback()
        batch.status = "error"
        batch.error_message = str(exc)[:1000]
        db.add(batch)
        db.commit()
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el Excel: {exc}") from exc
    finally:
        temp_path.unlink(missing_ok=True)


@router.get("/imports")
def list_imports(db: Session = Depends(database.get_db), current_user=Depends(get_current_active_user)):
    rows = db.query(models.RollizosImport).order_by(models.RollizosImport.created_at.desc()).limit(50).all()
    return [
        {
            "id": row.id,
            "filename": row.filename,
            "source_sheet": row.source_sheet,
            "status": row.status,
            "rows_read": row.rows_read,
            "rows_inserted": row.rows_inserted,
            "duplicates_skipped": row.duplicates_skipped,
            "invalid_rows": row.invalid_rows,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


@router.get("/report")
def get_report(
    year: Optional[int] = None,
    month: Optional[int] = None,
    product_length: Optional[float] = None,
    destination: Optional[str] = None,
    origin: Optional[str] = None,
    zone: Optional[str] = None,
    wood_state: Optional[str] = None,
    age_bucket: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user=Depends(get_current_active_user),
):
    kwargs = _base_filters_kwargs(year, month, product_length, destination, origin, zone, wood_state, age_bucket)
    records = _record_filters(db.query(models.DatosAntiguedad), **kwargs).all()
    age_by_month = defaultdict(list)
    age_volume = defaultdict(float)
    wood_volume = defaultdict(float)
    age_by_length = defaultdict(list)
    wood_totals = defaultdict(float)

    for row in records:
        month_number = row.month_number or 0
        month_label = _month_label(month_number, row.month or "Sin mes")
        if row.age_days is not None:
            age_by_month[month_label].append(row.age_days)
            if row.product_length is not None:
                age_by_length[(month_label, str(row.product_length))].append(row.age_days)
        if row.weight is not None:
            age_volume[(month_label, row.age_bucket or "Sin rango")] += row.weight
            state = row.wood_state or "Sin estado"
            if state not in PIVOT_WOOD_STATES:
                continue
            wood_volume[(month_label, state)] += row.weight
            wood_totals[state] += row.weight

    def average(values):
        return round(sum(values) / len(values), 3) if values else 0

    months = sorted(age_by_month.keys(), key=lambda value: MONTHS.index(value) if value in MONTHS else 99)
    age_by_month_data = [{"month": month_name, "value": average(age_by_month[month_name])} for month_name in months]
    age_volume_data = []
    for month_name in months:
        item = {"month": month_name}
        for bucket in ("<10 días", ">10 días"):
            item[bucket] = round(age_volume[(month_name, bucket)], 3)
        age_volume_data.append(item)

    age_percent_data = []
    for item in age_volume_data:
        total = item.get("<10 días", 0) + item.get(">10 días", 0)
        age_percent_data.append({
            "month": item["month"],
            "<10 días": round(item.get("<10 días", 0) / total * 100, 2) if total else 0,
            ">10 días": round(item.get(">10 días", 0) / total * 100, 2) if total else 0,
        })

    wood_states = [state for state in PIVOT_WOOD_STATES if any(key[1] == state for key in wood_volume)]
    wood_volume_data = []
    for month_name in months:
        item = {"month": month_name}
        for state in wood_states:
            item[state] = round(wood_volume[(month_name, state)], 3)
        wood_volume_data.append(item)

    wood_percent_data = []
    for item in wood_volume_data:
        total = sum(item.get(state, 0) for state in wood_states)
        wood_percent_data.append({"month": item["month"], **{
            state: round(item.get(state, 0) / total * 100, 2) if total else 0 for state in wood_states
        }})

    length_data_map = {}
    for (month_name, length), values in sorted(age_by_length.items(), key=lambda item: (MONTHS.index(item[0][0]) if item[0][0] in MONTHS else 99, item[0][1])):
        length_data_map.setdefault(month_name, {"month": month_name})[f"largo_{length}"] = average(values)
    length_data = list(length_data_map.values())

    return {
        "summary": {
            "records": len(records),
            "average_age": average([row.age_days for row in records if row.age_days is not None]),
            "total_weight": round(sum(row.weight or 0 for row in records), 3),
        },
        "charts": {
            "age_by_month": age_by_month_data,
            "age_volume": age_volume_data,
            "age_percent": age_percent_data,
            "wood_volume": wood_volume_data,
            "age_by_length": length_data,
            "wood_percent": wood_percent_data,
        },
        "options": {
            "years": sorted({row.year for row in records if row.year is not None}),
            "months": sorted({row.month_number for row in records if row.month_number is not None}),
            "lengths": sorted({row.product_length for row in records if row.product_length is not None}),
            "destinations": sorted({row.destination for row in records if row.destination}),
            "origins": sorted({row.origin for row in records if row.origin}),
            "zones": sorted({row.zone for row in records if row.zone}),
            "wood_states": wood_states,
            "age_buckets": ["<10 días", ">10 días"],
        },
    }
