from datetime import datetime
from uuid import uuid4

from database import models


INSPECTION_SUBTYPES = {'finished_lot', 'finished_line', 'line_grading'}


def validate_inspection_subtype(value):
    if value in (None, ''):
        return None
    if value not in INSPECTION_SUBTYPES:
        raise ValueError(f"Invalid inspection_subtype: {value}")
    return value


def _photo_data(photo):
    if isinstance(photo, str):
        return photo
    if isinstance(photo, dict):
        return photo.get('image_data') or photo.get('imageData') or photo.get('data_url') or photo.get('data') or photo.get('url')
    return getattr(photo, 'image_data', None)


def _parse_created_at(value):
    if not value:
        return datetime.now()
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace('Z', '+00:00')).replace(tzinfo=None)


def save_quality_alert(db, inspection, payload):
    if payload is None:
        return None
    if hasattr(payload, 'model_dump'):
        payload = payload.model_dump()

    photos = [_photo_data(photo) for photo in (payload.get('photos') or [])]
    if len(photos) > 6:
        raise ValueError('A quality alert may contain at most 6 photos')
    if any(not isinstance(photo, str) or not photo for photo in photos):
        raise ValueError('Each quality alert photo must contain image data')

    operator = payload.get('operator') or payload.get('operator_name') or payload.get('operator_id')
    reason = payload.get('reason')
    if not str(operator or '').strip():
        raise ValueError('Quality alert operator is required')
    if not str(reason or '').strip():
        raise ValueError('Quality alert reason is required')

    alert = inspection.quality_alert
    is_new = alert is None
    if alert is None:
        alert = models.QualityAlert(
            inspection=inspection,
            code=f"PENDING-{uuid4().hex}",
        )
        db.add(alert)

    if is_new or payload.get('created_at'):
        alert.created_at = _parse_created_at(payload.get('created_at'))
    alert.alert_type = payload.get('alert_type') or 'Defecto de procesos'
    alert.operator = str(operator).strip()
    alert.reason = str(reason).strip()
    alert.observations = payload.get('observations') or None
    alert.photos.clear()
    db.flush()
    alert.code = f"AC-{inspection.id}-{alert.id:06d}"
    alert.photos.extend(models.QualityAlertPhoto(image_data=photo) for photo in photos)
    return alert


def quality_alert_dict(alert):
    if alert is None:
        return None
    return {
        'id': alert.id,
        'alert_number': alert.id,
        'inspection_id': alert.inspection_id,
        'inspection_number': alert.inspection_id,
        'code': alert.code,
        'created_at': alert.created_at.isoformat() if alert.created_at else None,
        'alert_type': alert.alert_type,
        'operator': alert.operator,
        'operator_name': alert.operator,
        'reason': alert.reason,
        'observations': alert.observations,
        'photos': [photo.image_data for photo in alert.photos],
    }
