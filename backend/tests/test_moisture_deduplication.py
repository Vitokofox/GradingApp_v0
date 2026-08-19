from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from database import models
from services.wagner_l622_service import filter_new_readings


def _reading(record_number, moisture):
    return {
        "device_record_number": record_number,
        "moisture_percent": moisture,
        "captured_at": datetime(2026, 8, 18),
        "raw_line": f"{record_number} {moisture}",
    }


def test_filter_new_readings_skips_saved_and_repeated_keys():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(models.MoistureReading(
            capture_id=1,
            inspection_id=7,
            device_record_number=10,
            moisture_percent=12.5,
        ))
        db.commit()

        saved = _reading(10, 12.5)
        new = _reading(11, 13.0)
        other_value = _reading(10, 12.6)

        assert filter_new_readings(
            db, 7, [saved, new, new.copy(), other_value]
        ) == [new, other_value]


def test_filter_new_readings_scopes_keys_to_inspection():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(models.MoistureReading(
            capture_id=1,
            inspection_id=8,
            device_record_number=10,
            moisture_percent=12.5,
        ))
        db.commit()
        reading = _reading(10, 12.5)

        assert filter_new_readings(db, 7, [reading]) == [reading]
