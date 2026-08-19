from __future__ import annotations

import re
import threading
from datetime import datetime
from typing import Dict, List, Sequence

from sqlalchemy import tuple_
from sqlalchemy.orm import Session

from database import models

READING_PATTERN = re.compile(
    r"(?:^|[\r\n\f])\s*(\d+)\s+(\d+(?:[.,]\d+)?)\s*(?=[\r\n]|$)",
    re.MULTILINE,
)


def parse_l622_report(payload: str) -> List[Dict[str, object]]:
    """Parse the ASCII report emitted by the L622 and remove repeated frames."""
    readings = []
    seen = set()
    for match in READING_PATTERN.finditer(payload):
        record_number = int(match.group(1))
        moisture = float(match.group(2).replace(",", "."))
        if not 0 <= moisture <= 100:
            continue
        key = (record_number, moisture)
        if key in seen:
            continue
        seen.add(key)
        readings.append({
            "device_record_number": record_number,
            "moisture_percent": moisture,
            "raw_line": match.group(0).strip(),
            "captured_at": datetime.now(),
        })
    return readings


def filter_new_readings(
    db: Session,
    inspection_id: int,
    readings: Sequence[Dict[str, object]],
) -> List[Dict[str, object]]:
    """Return readings whose exact device key is not saved for the inspection."""
    unique_readings = []
    candidate_keys = set()
    for reading in readings:
        key = (reading["device_record_number"], reading["moisture_percent"])
        if key not in candidate_keys:
            candidate_keys.add(key)
            unique_readings.append(reading)

    if not candidate_keys:
        return []

    existing_keys = set(
        db.query(
            models.MoistureReading.device_record_number,
            models.MoistureReading.moisture_percent,
        )
        .filter(
            models.MoistureReading.inspection_id == inspection_id,
            tuple_(
                models.MoistureReading.device_record_number,
                models.MoistureReading.moisture_percent,
            ).in_(candidate_keys),
        )
        .all()
    )
    return [
        reading
        for reading in unique_readings
        if (reading["device_record_number"], reading["moisture_percent"])
        not in existing_keys
    ]


class WagnerL622Service:
    def __init__(self, port: str = "/dev/ttyUSB0", baudrate: int = 9600,
                 timeout: float = 1.0, enabled: bool = True):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.enabled = enabled
        self._lock = threading.Lock()

    @property
    def serial_settings(self) -> str:
        return f"{self.baudrate} 8N1"

    def capture(self, duration_seconds: float = 8, max_bytes: int = 512 * 1024) -> Dict[str, object]:
        """Listen without sending commands; the operator starts Print on the meter."""
        if not self.enabled:
            raise RuntimeError("La captura serial Wagner está deshabilitada por configuración.")
        try:
            import serial
        except ImportError as exc:
            raise RuntimeError("Falta instalar la dependencia pyserial en el backend.") from exc

        if not self._lock.acquire(blocking=False):
            raise RuntimeError("Ya existe una captura serial en curso.")
        try:
            chunks = []
            payload_size = 0
            with serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=self.timeout,
                write_timeout=self.timeout,
                xonxoff=False,
                rtscts=False,
                dsrdtr=False,
            ) as connection:
                deadline = datetime.now().timestamp() + duration_seconds
                while datetime.now().timestamp() < deadline:
                    data = connection.read(4096)
                    if data:
                        chunks.append(data)
                        payload_size += len(data)
                        if payload_size >= max_bytes:
                            break
            payload = b"".join(chunks).decode("ascii", errors="replace")
            return {"payload": payload, "readings": parse_l622_report(payload)}
        finally:
            self._lock.release()
