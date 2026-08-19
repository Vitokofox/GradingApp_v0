import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Camera, Download, ImagePlus, Printer, Trash2, X } from 'lucide-react';
import { getCatalogItems, saveInspectionQualityAlert } from '../api';
import { normalizeArray } from '../utils/dataUtils';
import QualityAlertCard from './QualityAlertCard';

const MAX_PHOTOS = 6;

const resizePhoto = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Formato de imagen no válido.'));
        image.onload = () => {
            const maxSide = 1600;
            const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        image.src = reader.result;
    };
    reader.readAsDataURL(file);
});

const createInitialAlert = (inspection) => {
    const provisional = `AC-${inspection.id}-LOCAL`;
    return {
        code: provisional,
        alert_number: 'LOCAL',
        inspection_number: inspection.id,
        inspection_id: inspection.id,
        alert_type: 'Defecto de procesos',
        operator_id: '',
        operator_name: '',
        reason: '',
        observations: '',
        photos: [],
        date: inspection.date || new Date().toISOString().split('T')[0],
        product_name: inspection.product_name || '',
        lot: inspection.lot || '',
        machine: inspection.machine || '',
        shift: inspection.shift || '',
        responsible: inspection.responsible || '',
        created_at: new Date().toISOString(),
        provisional: true,
    };
};

export default function QualityAlertModal({ inspection, editable = false, onClose, onSaved }) {
    const [qualityAlert, setQualityAlert] = useState(() => inspection.quality_alert || createInitialAlert(inspection));
    const [operators, setOperators] = useState([]);
    const [saving, setSaving] = useState(false);
    const [processingPhotos, setProcessingPhotos] = useState(false);
    const [showCard, setShowCard] = useState(!editable);
    const cardRef = useRef(null);

    useEffect(() => {
        getCatalogItems('operator').then(data => setOperators(normalizeArray(data))).catch(() => setOperators([]));
    }, []);

    const update = (field, fieldValue) => setQualityAlert(current => ({ ...current, [field]: fieldValue }));

    const addPhotos = async (event) => {
        const slots = MAX_PHOTOS - normalizeArray(qualityAlert.photos).length;
        const files = Array.from(event.target.files || []).slice(0, slots);
        event.target.value = '';
        if (!files.length) return;
        setProcessingPhotos(true);
        try {
            const resized = await Promise.all(files.map(resizePhoto));
            setQualityAlert(current => ({ ...current, photos: [...normalizeArray(current.photos), ...resized].slice(0, MAX_PHOTOS) }));
        } catch (error) {
            alert(error.message);
        } finally {
            setProcessingPhotos(false);
        }
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (!qualityAlert.operator_id || !qualityAlert.reason.trim()) {
            window.alert('Operador y motivo son obligatorios.');
            return;
        }
        setSaving(true);
        try {
            const operator = operators.find(item => String(item.id) === String(qualityAlert.operator_id));
            const savedAlert = { ...qualityAlert, operator_name: operator?.name || qualityAlert.operator_name, updated_at: new Date().toISOString() };
            await saveInspectionQualityAlert(inspection.id, savedAlert);
            setQualityAlert(savedAlert);
            setShowCard(true);
            onSaved?.(savedAlert);
        } catch (error) {
            window.alert(error.message);
        } finally {
            setSaving(false);
        }
    };

    const downloadPdf = async () => {
        if (!cardRef.current) return;
        const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const scale = Math.min(277 / canvas.width, 190 / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (297 - width) / 2, (210 - height) / 2, width, height);
        pdf.save(`${qualityAlert.code || 'alerta-calidad'}.pdf`);
    };

    const printCard = () => {
        const landscapeStyle = document.createElement('style');
        landscapeStyle.textContent = '@media print { @page { size: A4 landscape; } }';
        document.head.appendChild(landscapeStyle);
        window.print();
        window.setTimeout(() => landscapeStyle.remove(), 1000);
    };

    return (
        <div className="ga-modal-backdrop quality-alert-modal-backdrop">
            <div className="ga-modal quality-alert-modal">
                <div className="ga-modal__header ga-no-print">
                    <h2 className="ga-card__title">{inspection.quality_alert ? 'Ver / Editar alerta de calidad' : 'Crear alerta de calidad'}</h2>
                    <button type="button" onClick={onClose} className="ga-btn ga-btn--icon" aria-label="Cerrar"><X size={20} /></button>
                </div>

                <div className="ga-modal__content quality-alert-modal__content">
                    {showCard ? (
                        <div className="quality-alert-print-root"><QualityAlertCard ref={cardRef} alert={qualityAlert} inspection={inspection} /></div>
                    ) : (
                        <form id="quality-alert-form" onSubmit={handleSave} className="ga-stack">
                            <div className="ga-grid ga-grid--3">
                                <div><label className="ga-label">N° inspección</label><input className="ga-control" value={inspection.id} readOnly /></div>
                                <div><label className="ga-label">Código provisional</label><input className="ga-control" value={qualityAlert.code} readOnly /></div>
                                <div><label className="ga-label">N° alerta provisional</label><input className="ga-control" value={qualityAlert.alert_number} readOnly /></div>
                                <div><label className="ga-label">Tipo de alerta</label><input className="ga-control" value={qualityAlert.alert_type} onChange={e => update('alert_type', e.target.value)} /></div>
                                <div><label className="ga-label">Producto</label><input className="ga-control" value={qualityAlert.product_name} readOnly /></div>
                                <div><label className="ga-label">Lote / línea</label><input className="ga-control" value={qualityAlert.lot} readOnly /></div>
                                <div>
                                    <label className="ga-label">Operador *</label>
                                    <select className="ga-control" value={qualityAlert.operator_id} onChange={e => update('operator_id', e.target.value)} required>
                                        <option value="">Seleccionar...</option>
                                        {operators.map(operator => <option key={operator.id} value={operator.id}>{operator.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className="ga-label">Motivo *</label><textarea className="ga-control" rows="3" value={qualityAlert.reason} onChange={e => update('reason', e.target.value)} required /></div>
                            <div><label className="ga-label">Observaciones</label><textarea className="ga-control" rows="3" value={qualityAlert.observations} onChange={e => update('observations', e.target.value)} /></div>
                            <div>
                                <label className="ga-label">Fotografías ({normalizeArray(qualityAlert.photos).length}/{MAX_PHOTOS})</label>
                                <div className="quality-alert-photo-actions">
                                    <label className="ga-btn ga-btn--outline"><Camera size={17} /> Cámara<input type="file" accept="image/*" capture="environment" onChange={addPhotos} hidden disabled={processingPhotos || qualityAlert.photos.length >= MAX_PHOTOS} /></label>
                                    <label className="ga-btn ga-btn--outline"><ImagePlus size={17} /> Galería<input type="file" accept="image/*" multiple onChange={addPhotos} hidden disabled={processingPhotos || qualityAlert.photos.length >= MAX_PHOTOS} /></label>
                                    {processingPhotos && <span className="u-muted">Procesando...</span>}
                                </div>
                                <div className="quality-alert-photo-previews">
                                    {normalizeArray(qualityAlert.photos).map((photo, index) => (
                                        <div key={`${index}-${photo.slice(-12)}`}><img src={photo} alt={`Vista previa ${index + 1}`} /><button type="button" onClick={() => update('photos', qualityAlert.photos.filter((_, photoIndex) => photoIndex !== index))}><Trash2 size={15} /></button></div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                <div className="ga-modal__footer ga-no-print quality-alert-modal__footer">
                    {showCard ? <>
                        {editable && <button type="button" className="ga-btn ga-btn--outline" onClick={() => setShowCard(false)}>Editar</button>}
                        <button type="button" className="ga-btn ga-btn--outline" onClick={printCard}><Printer size={17} /> Imprimir</button>
                        <button type="button" className="ga-btn ga-btn--secondary" onClick={downloadPdf}><Download size={17} /> PDF</button>
                    </> : <>
                        <button type="button" className="ga-btn ga-btn--outline" onClick={onClose}>Cancelar</button>
                        <button form="quality-alert-form" className="ga-btn ga-btn--secondary" disabled={saving || processingPhotos}>{saving ? 'Guardando...' : 'Guardar alerta'}</button>
                    </>}
                </div>
            </div>
        </div>
    );
}
