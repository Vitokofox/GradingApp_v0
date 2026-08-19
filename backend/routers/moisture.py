import os
import threading
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import database, models
from routers.auth import get_current_active_user
from services.wagner_l622_service import WagnerL622Service, filter_new_readings
import schemas


router = APIRouter(prefix="/api", tags=["moisture"])
_service = WagnerL622Service(
    port=os.getenv("WAGNER_SERIAL_PORT", "COM3" if os.name == "nt" else "/dev/ttyUSB0"),
    baudrate=int(os.getenv("WAGNER_SERIAL_BAUDRATE", "9600")),
    timeout=float(os.getenv("WAGNER_SERIAL_TIMEOUT", "1")),
    enabled=os.getenv("WAGNER_SERIAL_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"},
)


def _capture_response(capture: models.MoistureCapture):
    return {
        "id": capture.id,
        "inspection_id": capture.inspection_id,
        "started_at": capture.started_at,
        "completed_at": capture.completed_at,
        "status": capture.status,
        "serial_port": capture.serial_port,
        "serial_settings": capture.serial_settings,
        "raw_payload": capture.raw_payload,
        "error_message": capture.error_message,
        "readings": capture.readings,
    }


def _run_capture(capture_id: int):
    db = database.SessionLocal()
    try:
        capture = db.query(models.MoistureCapture).filter(models.MoistureCapture.id == capture_id).first()
        if not capture:
            return
        try:
            result = _service.capture()
            capture.raw_payload = result["payload"]
            new_readings = filter_new_readings(
                db, capture.inspection_id, result["readings"]
            )
            for reading in new_readings:
                capture.readings.append(models.MoistureReading(
                    inspection_id=capture.inspection_id,
                    device_record_number=reading["device_record_number"],
                    moisture_percent=reading["moisture_percent"],
                    captured_at=reading["captured_at"],
                    raw_line=reading["raw_line"],
                ))
            capture.status = "completed" if result["readings"] else "no_data"
        except Exception as exc:
            capture.status = "error"
            capture.error_message = str(exc)
        capture.completed_at = datetime.now()
        db.commit()
    finally:
        db.close()


@router.get("/moisture/status")
def moisture_status():
    return {"enabled": _service.enabled, "port": _service.port, "serial_settings": _service.serial_settings}


@router.post("/inspections/{inspection_id}/moisture/captures", response_model=schemas.MoistureCaptureResponse)
def start_moisture_capture(
    inspection_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_active_user),
):
    inspection = db.query(models.Inspection).filter(models.Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    active = db.query(models.MoistureCapture).filter(models.MoistureCapture.status == "capturing").first()
    if active:
        raise HTTPException(status_code=409, detail="Ya existe una captura de humedad en curso")

    capture = models.MoistureCapture(
        inspection_id=inspection_id,
        serial_port=_service.port,
        serial_settings=_service.serial_settings,
        created_by=current_user.id,
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    threading.Thread(target=_run_capture, args=(capture.id,), daemon=True).start()
    return _capture_response(capture)


@router.get("/moisture/captures/{capture_id}", response_model=schemas.MoistureCaptureResponse)
def get_moisture_capture(capture_id: int, db: Session = Depends(database.get_db)):
    capture = db.query(models.MoistureCapture).options(joinedload(models.MoistureCapture.readings)).filter(models.MoistureCapture.id == capture_id).first()
    if not capture:
        raise HTTPException(status_code=404, detail="Captura no encontrada")
    return _capture_response(capture)


@router.get("/inspections/{inspection_id}/moisture/readings", response_model=list[schemas.MoistureReadingResponse])
def get_moisture_readings(inspection_id: int, db: Session = Depends(database.get_db)):
    readings = db.query(models.MoistureReading).filter(models.MoistureReading.inspection_id == inspection_id).order_by(models.MoistureReading.captured_at.asc()).all()
    return readings
