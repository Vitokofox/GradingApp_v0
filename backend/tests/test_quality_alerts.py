from datetime import date

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import schemas
from database import models
from services.quality_alerts import quality_alert_dict, save_quality_alert


def _inspection(market_id):
    return models.Inspection(
        date=date(2026, 8, 18),
        production_date=date(2026, 8, 18),
        shift='A',
        journey='Dia',
        supervisor='Supervisor',
        responsible='Responsable',
        area='Area',
        machine='Maquina',
        origin='Origen',
        lot='LOTE-1',
        market_id=market_id,
        product_name='Producto',
        state='Terminado',
        termination='Seco',
        thickness='1',
        width='2',
        length='3',
        type='inspection',
        inspection_subtype='finished_lot',
    )


def test_quality_alert_gets_definitive_code_and_preserves_photos():
    engine = create_engine('sqlite:///:memory:')
    models.Base.metadata.create_all(engine)

    with Session(engine) as db:
        market = models.Market(name='Mercado')
        db.add(market)
        db.flush()
        inspection = _inspection(market.id)
        db.add(inspection)
        db.flush()

        alert = save_quality_alert(db, inspection, {
            'operator_name': 'Operador 1',
            'reason': 'Desalineado',
            'photos': ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
        })
        db.commit()

        assert alert.code == f'AC-{inspection.id}-{alert.id:06d}'
        assert quality_alert_dict(alert)['photos'] == [
            'data:image/jpeg;base64,AAA',
            'data:image/jpeg;base64,BBB',
        ]
        assert db.query(models.QualityAlert).count() == 1


def test_quality_alert_schema_rejects_more_than_six_photos():
    with pytest.raises(ValidationError):
        schemas.QualityAlertCreate(
            operator='Operador 1',
            reason='Defecto',
            photos=['data:image/jpeg;base64,AAA'] * 7,
        )
