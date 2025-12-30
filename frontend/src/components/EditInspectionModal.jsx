
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, ChevronDown, ChevronUp, Edit } from 'lucide-react';
import { updateInspection, getInspectionResults, updateInspectionResult } from '../api';

export default function EditInspectionModal({ isOpen, onClose, inspection, onUpdate }) {
    const [formData, setFormData] = useState({
        product_name: '',
        date: '',
        lot: '',
        supervisor: '',
        responsible: '',
        shift: '',
        journey: '',
        origin: '',
        area: '',
        machine: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [results, setResults] = useState([]);
    const [loadingResults, setLoadingResults] = useState(false);
    const [expandedResults, setExpandedResults] = useState(false);

    useEffect(() => {
        if (inspection) {
            setFormData({
                product_name: inspection.product_name || '',
                date: inspection.date || '',
                lot: inspection.lot || '',
                supervisor: inspection.supervisor || '',
                responsible: inspection.responsible || '',
                shift: inspection.shift || '',
                journey: inspection.journey || '',
                origin: inspection.origin || '',
                area: inspection.area || '',
                machine: inspection.machine || ''
            });
            setError(null);
            fetchResults(inspection.id);
        }
    }, [inspection]);

    const fetchResults = async (id) => {
        setLoadingResults(true);
        try {
            const data = await getInspectionResults(id);
            setResults(data);
        } catch (error) {
            console.error("Error fetching results", error);
        } finally {
            setLoadingResults(false);
        }
    };

    const handleResultChange = (id, newCount) => {
        setResults(prev => prev.map(r => r.id === id ? { ...r, pieces_count: newCount, isDirty: true } : r));
    };

    const saveResult = async (result) => {
        try {
            await updateInspectionResult(result.id, result.pieces_count);
            // Mark as not dirty or refresh
            setResults(prev => prev.map(r => r.id === result.id ? { ...r, isDirty: false } : r));
        } catch (error) {
            console.error(error);
            setError("Error al guardar el resultado.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await updateInspection(inspection.id, formData);
            onUpdate(); // Reload parent list
            onClose();
        } catch (err) {
            console.error(err);
            setError("Error al actualizar la inspección. Revisa consolas.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    padding: '1rem'
                }}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="ga-card"
                    style={{
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        padding: 0
                    }}
                >
                    <div className="ga-card__header" style={{ flex: '0 0 auto' }}>
                        <h2 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Edit size={20} className="u-accent" />
                            Editar Inspección #{inspection?.id}
                        </h2>
                        <button onClick={onClose} className="ga-btn ga-btn--text u-muted">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="custom-scrollbar" style={{ flex: '1 1 auto', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {error && (
                            <div className="ga-alert ga-alert--error">
                                <AlertTriangle size={16} /> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="ga-stack">
                            <h3 className="u-bold u-muted u-uppercase" style={{ fontSize: '0.875rem', borderBottom: '1px solid var(--ga-border)', paddingBottom: '0.5rem' }}>
                                Información General
                            </h3>

                            <div className="ga-grid ga-grid--3">
                                <InputField label="Producto" value={formData.product_name} onChange={v => setFormData({ ...formData, product_name: v })} required />
                                <InputField label="Fecha" value={formData.date} onChange={v => setFormData({ ...formData, date: v })} type="date" required />
                                <InputField label="Lote" value={formData.lot} onChange={v => setFormData({ ...formData, lot: v })} />
                                <InputField label="Responsable" value={formData.responsible} onChange={v => setFormData({ ...formData, responsible: v })} />
                                <InputField label="Supervisor" value={formData.supervisor} onChange={v => setFormData({ ...formData, supervisor: v })} />
                                <InputField label="Turno" value={formData.shift} onChange={v => setFormData({ ...formData, shift: v })} />
                                <InputField label="Jornada" value={formData.journey} onChange={v => setFormData({ ...formData, journey: v })} />
                                <InputField label="Area" value={formData.area} onChange={v => setFormData({ ...formData, area: v })} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="ga-btn ga-btn--primary"
                                >
                                    {loading ? 'Guardando...' : <><Save size={16} style={{ marginRight: '0.5rem' }} /> Guardar Encabezado</>}
                                </button>
                            </div>
                        </form>

                        <div className="ga-stack">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--ga-border)', paddingBottom: '0.5rem' }}>
                                <h3 className="u-bold u-uppercase" style={{ fontSize: '0.875rem', color: 'var(--ga-info)' }}>Resultados y Conteos</h3>
                                <button onClick={() => setExpandedResults(!expandedResults)} className="ga-btn ga-btn--text u-muted">
                                    {expandedResults ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>

                            {expandedResults && (
                                loadingResults ? <div className="u-center u-muted">Cargando resultados...</div> : (
                                    <div className="ga-stack" style={{ gap: '0.5rem' }}>
                                        {results.map(r => (
                                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--ga-bg)', borderRadius: 'var(--ga-radius-sm)', border: '1px solid var(--ga-border)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '100px', fontWeight: 'bold', fontSize: '0.875rem' }}>{r.grade?.name}</div>
                                                    <div style={{ fontSize: '0.875rem', color: 'var(--ga-muted)' }}>{r.defect?.name || 'Sin Defecto (Base)'}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="number"
                                                        value={r.pieces_count}
                                                        onChange={(e) => handleResultChange(r.id, e.target.value)}
                                                        className="ga-control"
                                                        style={{
                                                            width: '80px',
                                                            textAlign: 'center',
                                                            borderColor: r.isDirty ? 'var(--ga-warning)' : undefined
                                                        }}
                                                    />
                                                    {r.isDirty && (
                                                        <button
                                                            onClick={() => saveResult(r)}
                                                            className="ga-btn ga-btn--warning ga-btn--sm"
                                                            title="Guardar cambio"
                                                        >
                                                            <Save size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {results.length === 0 && <div className="u-center u-muted u-italic">No hay resultados registrados.</div>}
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    <div className="ga-card__body" style={{ background: 'var(--ga-bg)', borderTop: '1px solid var(--ga-border)', display: 'flex', justifyContent: 'flex-end', flex: '0 0 auto', padding: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="ga-btn ga-btn--secondary"
                        >
                            Cerrar
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function InputField({ label, value, onChange, type = "text", required = false }) {
    return (
        <div>
            <label className="ga-label">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="ga-control"
                required={required}
            />
        </div>
    );
}
