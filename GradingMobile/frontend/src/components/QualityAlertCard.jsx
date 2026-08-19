import { forwardRef } from 'react';

const value = (item, fallback = '-') => item === undefined || item === null || item === '' ? fallback : item;

const QualityAlertCard = forwardRef(function QualityAlertCard({ alert, inspection }, ref) {
    if (!alert) return null;

    const operator = alert.operator_name || alert.operator?.name || alert.operator || '-';
    const photos = Array.isArray(alert.photos) ? alert.photos.slice(0, 6) : [];
    const origin = [inspection?.area, inspection?.origin].filter(Boolean).join(' / ');
    const dimensions = [inspection?.thickness, inspection?.width, inspection?.length].filter(Boolean).join(' x ');
    const fields = [
        ['Turno', alert.shift || inspection?.shift],
        ['Centro / Origen', origin],
        ['Máquina', alert.machine || inspection?.machine],
        ['Supervisor', inspection?.supervisor],
        ['Operador', operator],
        ['Inspector', alert.responsible || inspection?.responsible],
        ['Producto', alert.product_name || inspection?.product_name],
        ['Lote / línea', alert.lot || inspection?.lot],
        ['Dimensiones', dimensions],
    ];

    return (
        <article ref={ref} className="quality-alert-card">
            <header className="quality-alert-card__header">
                <div>
                    <div className="quality-alert-card__eyebrow">CONTROL DE CALIDAD</div>
                    <h2>Alerta de calidad</h2>
                    <div className="quality-alert-card__type">Tipo de alerta: {value(alert.alert_type)}</div>
                </div>
                <div className="quality-alert-card__identity">
                    <strong>N° {value(alert.alert_number || alert.number || alert.id, 'LOCAL')}</strong>
                    <span>{value(alert.code)}</span>
                    <span>Inspección N° {value(alert.inspection_number || inspection?.id)}</span>
                    <span>Fecha: {value(alert.date || inspection?.date)}</span>
                </div>
            </header>

            <div className="quality-alert-card__body">
                <section className="quality-alert-card__fields">
                    {fields.map(([label, fieldValue]) => (
                        <div key={label}>
                            <span>{label}</span>
                            <strong>{value(fieldValue)}</strong>
                        </div>
                    ))}
                </section>

                <section className="quality-alert-card__photos">
                    {photos.length > 0 ? photos.map((photo, index) => (
                        <img key={`${index}-${photo.slice(-12)}`} src={photo} alt={`Evidencia ${index + 1}`} />
                    )) : <div className="quality-alert-card__empty">Sin fotografías</div>}
                </section>
            </div>

            <section className="quality-alert-card__note">
                <h3>Motivo del rechazo</h3>
                <p>{value(alert.reason)}</p>
            </section>
            <section className="quality-alert-card__note">
                <h3>Observaciones</h3>
                <p>{value(alert.observations)}</p>
            </section>
        </article>
    );
});

export default QualityAlertCard;
