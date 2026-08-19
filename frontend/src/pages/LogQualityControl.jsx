import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { normalizeArray, getLocalISODate, formatSpanishDate } from '../utils/dataUtils';
import {
    Activity, Calendar, Tag, Shield, Clipboard, Search,
    Plus, CheckCircle, ChevronRight, X, User, Layers, Info, Trash2, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEFECTS = [
    { key: 'freckles', label: 'Pecas' },
    { key: 'splintering', label: 'Astillamiento' },
    { key: 'fissures', label: 'Fisuras' },
    { key: 'spores', label: 'Esporas' },
    { key: 'blue_stain', label: 'M. Azul' },
    { key: 'bark', label: 'Corteza' },
    { key: 'rot', label: 'Pudrición' },
    { key: 'bad_pruning', label: 'Mal Desrame' }
];

// Removed WOOD_TYPES and BINS since they will be inline or unused.

// Default row for detailed table
const createEmptyLog = (id) => ({
    id,
    jas_diameter: '',
    actual_length: '',
    curvature: '',
    double_curvature: '',
    freckles: false,
    splintering: false,
    fissures: false,
    spores: false,
    blue_stain: false,
    bark: false,
    rot: false,
    bad_pruning: false,
    other: ''
});

const LogQualityControl = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // -- State --
    const [mode, setMode] = useState('detallado'); // 'detallado' o 'conteo'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const [header, setHeader] = useState({
        date: getLocalISODate(),
        shift: '',
        responsible: '',
        target_diameter: '',
        target_length: '',
        bin_type: 'Venta',
        bin_num: ''
    });

    const [shifts, setShifts] = useState([]);
    const [recentInspections, setRecentInspections] = useState([]);

    // Detailed Mode State
    const [logs, setLogs] = useState(Array.from({ length: 15 }, (_, i) => createEmptyLog(i)));

    // Count Mode State
    const [sampleTotal, setSampleTotal] = useState('');
    const [fastDefects, setFastDefects] = useState([]); // [{ name: '', count: '', isNewCustom: false }]

    // For custom typed defects in the dropdown
    const [customDefectsList, setCustomDefectsList] = useState(() => {
        try { return JSON.parse(localStorage.getItem('ga_custom_log_defects_list') || '[]'); }
        catch { return []; }
    });

    const defectSum = fastDefects.reduce((acc, obj) => acc + (parseInt(obj.count) || 0), 0);
    const sanosCount = Math.max(0, (parseInt(sampleTotal) || 0) - defectSum);

    const availableDefectNames = [
        ...DEFECTS.map(d => d.label),
        ...customDefectsList
    ];

    useEffect(() => {
        if (user) {
            setHeader(prev => ({
                ...prev,
                responsible: user.first_name ? `${user.first_name} ${user.last_name || ''}` : (user.username || 'Admin')
            }));
        }
        fetchRecentInspections();
        fetchShifts();
    }, [user]);

    const fetchShifts = async () => {
        try {
            const response = await api.get('/api/inspections/distinct/shift');
            setShifts(normalizeArray(response.data));
        } catch (error) {
            console.error('Error fetching shifts:', error);
            setShifts(['Turno 1', 'Turno 2', 'Turno 3']); // Fallback
        }
    };

    const fetchRecentInspections = async () => {
        try {
            const response = await api.get('/api/log-inspections/');
            const safeData = normalizeArray(response.data);
            setRecentInspections(safeData.slice(0, 10));
        } catch (error) {
            console.error('Error fetching recents:', error);
        }
    };

    const handleHeaderChange = (e) => {
        const { name, value } = e.target;
        setHeader(prev => ({ ...prev, [name]: value }));
    };

    const handleLogChange = (index, field, value, type = 'text') => {
        const newLogs = [...logs];
        newLogs[index][field] = value;
        setLogs(newLogs);
    };

    const removeLogRow = (indexToRemove) => {
        setLogs(logs.filter((_, idx) => idx !== indexToRemove));
    };

    const addLogRow = () => {
        setLogs([...logs, createEmptyLog(Date.now())]);
    };

    const clearForms = () => {
        setLogs(Array.from({ length: 15 }, (_, i) => createEmptyLog(i)));
        setFastDefects([]);
        setSampleTotal('');
    };

    const addFastDefectRow = () => {
        setFastDefects([...fastDefects, { name: '', count: '', isNewCustom: false }]);
    };

    const removeFastDefectRow = (index) => {
        setFastDefects(fastDefects.filter((_, i) => i !== index));
    };

    const handleFastDefectChange = (index, field, value) => {
        const newArr = [...fastDefects];

        if (field === 'name' && value === 'OTRO_CUSTOM_OP') {
            newArr[index].isNewCustom = true;
            newArr[index].name = '';
        } else {
            newArr[index][field] = value;
            if (field === 'name') newArr[index].isNewCustom = false;
        }

        setFastDefects(newArr);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        let finalLogs = [];

        if (mode === 'detallado') {
            finalLogs = logs.filter(row => row.jas_diameter || row.actual_length || row.other || DEFECTS.some(d => row[d.key]))
                .map(({ id, ...rest }) => rest);
        } else {
            // Convert counters into individual logs
            const generateLogs = (count, defectName) => {
                const arr = [];
                const standardDefect = defectName ? DEFECTS.find(d => d.label === defectName) : null;

                for (let i = 0; i < count; i++) {
                    const l = createEmptyLog(i);
                    delete l.id;
                    if (defectName) {
                        if (standardDefect) {
                            l[standardDefect.key] = true;
                        } else {
                            l.other = defectName;
                        }
                    }
                    arr.push(l);
                }
                return arr;
            };

            finalLogs.push(...generateLogs(sanosCount, null));

            fastDefects.forEach(defect => {
                const count = parseInt(defect.count) || 0;
                if (count > 0 && defect.name.trim()) {
                    const defectName = defect.name.trim();
                    finalLogs.push(...generateLogs(count, defectName));

                    // Save to custom list if not exists
                    if (!availableDefectNames.includes(defectName) && defectName !== 'OTRO_CUSTOM_OP') {
                        const updated = [...customDefectsList, defectName];
                        setCustomDefectsList(updated);
                        localStorage.setItem('ga_custom_log_defects_list', JSON.stringify(updated));
                    }
                }
            });
        }

        if (finalLogs.length === 0) {
            setMessage({ type: 'error', text: 'Debe ingresar al menos un registro (trozo).' });
            setLoading(false);
            return;
        }

        if (!header.shift || !header.bin_type || !header.bin_num) {
            setMessage({ type: 'error', text: 'Por favor complete todos los datos de cabecera (Turno, Tipo Buzón y Número son requeridos).' });
            setLoading(false);
            return;
        }

        const payload = {
            ...header,
            wood_type: 'Pino', // Hardcoded as per business rule
            bin_number: `${header.bin_type} ${header.bin_num}`,
            logs: finalLogs.map(l => ({
                ...l,
                jas_diameter: l.jas_diameter ? parseFloat(l.jas_diameter) : null,
                actual_length: l.actual_length ? parseFloat(l.actual_length) : null,
                curvature: l.curvature ? parseFloat(l.curvature) : null,
                double_curvature: l.double_curvature ? parseFloat(l.double_curvature) : null,
                other: l.other || null
            }))
        };

        try {
            await api.post('/api/log-inspections/', payload);
            setMessage({ type: 'success', text: `¡Estudio guardado exitosamente con ${finalLogs.length} trozos procesados!` });
            fetchRecentInspections();
            clearForms();
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Error al comunicarse con el servidor.' });
        } finally {
            setLoading(false);
        }
    };

    // Derived states for UI
    const totalCountModeLogs = sanosCount + defectSum;

    return (
        <div style={{ padding: '2rem', background: '#f4f7f6', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <header style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: 'white',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.3)'
                    }}>
                        <FileText size={32} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>
                            CONTROL CALIDAD DE TROZOS
                        </h1>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '1.05rem', fontWeight: 500 }}>
                            Inspección detallada y clasificación por buzones
                        </p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '2rem' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Cabecera / Filtros Card */}
                        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                            <div style={{ background: '#f8fafc', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Clipboard color="#0f172a" size={20} />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Datos del Estudio</h3>
                            </div>

                            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Fecha</label>
                                    <input type="date" name="date" value={header.date} onChange={handleHeaderChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Turno</label>
                                    <select name="shift" value={header.shift} onChange={handleHeaderChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}>
                                        <option value="">Seleccionar</option>
                                        <option value="Turno 1">Turno 1</option>
                                        <option value="Turno 2">Turno 2</option>
                                        <option value="Turno 3">Turno 3</option>
                                    </select>
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Tipo de Buzón</label>
                                    <select name="bin_type" value={header.bin_type} onChange={handleHeaderChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}>
                                        <option value="Venta">Venta</option>
                                        <option value="Rechazo">Rechazo</option>
                                        <option value="Reproceso">Reproceso</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>N° Buzón (1-80)</label>
                                    <input type="number" min="1" max="80" name="bin_num" value={header.bin_num} onChange={handleHeaderChange} placeholder="1 al 80" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Diám. Objetivo (cm)</label>
                                    <input type="number" step="0.1" name="target_diameter" value={header.target_diameter} onChange={handleHeaderChange} placeholder="Ej: 24.5" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Largo Trozo (mm)</label>
                                    <input type="number" step="1" name="target_length" value={header.target_length} onChange={handleHeaderChange} placeholder="Ej: 4100" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
                                </div>
                            </div>
                        </div>

                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Selector de Modos */}
                        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '0.5rem', display: 'flex', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <button
                                type="button"
                                onClick={() => setMode('detallado')}
                                style={{
                                    flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s',
                                    background: mode === 'detallado' ? '#0f172a' : 'transparent',
                                    color: mode === 'detallado' ? 'white' : '#64748b',
                                    fontWeight: mode === 'detallado' ? 700 : 600
                                }}
                            >
                                <Activity size={18} /> Estudio Largo y Grado
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('conteo')}
                                style={{
                                    flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s',
                                    background: mode === 'conteo' ? '#0f172a' : 'transparent',
                                    color: mode === 'conteo' ? 'white' : '#64748b',
                                    fontWeight: mode === 'conteo' ? 700 : 600
                                }}
                            >
                                <Search size={18} /> Estudio Grado Buzones
                            </button>
                        </div>

                        {/* Summary / Save Card */}
                        <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '16px', padding: '1.5rem', color: 'white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Resumen Estudio</h4>
                                    <div style={{ fontSize: '2rem', fontWeight: 900, marginTop: '0.25rem' }}>
                                        {mode === 'detallado' ? logs.filter(l => l.jas_diameter || l.actual_length || DEFECTS.some(d => l[d.key])).length : totalCountModeLogs} <span style={{ fontSize: '1rem', fontWeight: 600, color: '#94a3b8' }}>trozos eval.</span>
                                    </div>
                                </div>
                                <Shield size={40} color="#38bdf8" style={{ opacity: 0.8 }} />
                            </div>

                            {message && (
                                <div style={{ padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', background: message.type === 'success' ? '#064e3b' : '#7f1d1d', color: message.type === 'success' ? '#a7f3d0' : '#fecaca', border: `1px solid ${message.type === 'success' ? '#059669' : '#dc2626'}` }}>
                                    {message.type === 'success' ? <CheckCircle size={18} /> : <Info size={18} />}
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%', padding: '1rem', background: '#38bdf8', color: '#0f172a',
                                    border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '1.05rem',
                                    cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', gap: '0.5rem', transition: 'background 0.2s',
                                    boxShadow: '0 4px 6px -1px rgba(56, 189, 248, 0.4)'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#0ea5e9'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#38bdf8'}
                            >
                                {loading ? 'PROCESANDO...' : 'GUARDAR ESTUDIO'}
                            </button>
                        </div>

                    </div>
                </div>

                {/* Input Area (Transforms based on mode) */}
                <div style={{ marginTop: '2rem', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    {mode === 'detallado' ? (
                        <>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Inspección Pieza a Pieza</h3>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Trozos en vista: {logs.length}</div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1 }}>#</th>
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '90px' }}>Diam JAS (cm)</th>
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '90px' }}>Largo (mm)</th>
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '90px' }}>Curv. (mm)</th>
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '90px' }}>D. Curv. (mm)</th>
                                            {DEFECTS.map(d => (
                                                <th key={d.key} style={{ padding: '0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '70px' }}>{d.label}</th>
                                            ))}
                                            <th style={{ padding: '0.75rem', fontWeight: 700, color: '#475569' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((row, idx) => (
                                            <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 800, color: '#94a3b8', position: 'sticky', left: 0, background: 'inherit' }}>{idx + 1}</td>
                                                <td style={{ padding: '0.5rem' }}><input type="number" step="0.1" value={row.jas_diameter} onChange={(e) => handleLogChange(idx, 'jas_diameter', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></td>
                                                <td style={{ padding: '0.5rem' }}><input type="number" step="1" value={row.actual_length} onChange={(e) => handleLogChange(idx, 'actual_length', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></td>
                                                <td style={{ padding: '0.5rem' }}><input type="number" step="1" value={row.curvature} onChange={(e) => handleLogChange(idx, 'curvature', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></td>
                                                <td style={{ padding: '0.5rem' }}><input type="number" step="1" value={row.double_curvature} onChange={(e) => handleLogChange(idx, 'double_curvature', e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }} /></td>
                                                {DEFECTS.map(d => (
                                                    <td key={d.key} style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                        <input type="checkbox" checked={row[d.key]} onChange={(e) => handleLogChange(idx, d.key, e.target.checked, 'checkbox')} style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: '#0369a1' }} />
                                                    </td>
                                                ))}
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <button type="button" onClick={() => removeLogRow(idx)} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar Fila"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ padding: '1rem', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
                                <button type="button" onClick={addLogRow} style={{ background: '#e0f2fe', border: '1px dashed #38bdf8', color: '#0284c7', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}>
                                    <Plus size={18} /> Agregar Fila
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '2rem' }}>
                            <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
                                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Grados de Trozos</h3>
                                <p style={{ color: '#64748b', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>
                                    Ingrese la <strong>cantidad total de la muestra</strong> y agregue iterativamente los defectos encontrados.
                                </p>
                            </div>

                            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem' }}>
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Muestra (Tzs)</label>
                                        <input
                                            type="number" min="0" required={mode === 'conteo'}
                                            value={sampleTotal}
                                            onChange={(e) => setSampleTotal(e.target.value)}
                                            placeholder="Ingresa cantidad..."
                                            style={{ width: '100%', fontSize: '1.2rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#0f172a' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ backgroundColor: '#fdfdfd', border: '1px dashed #cbd5e1', padding: '1.5rem', borderRadius: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#334155', fontWeight: 700 }}>Defectos</h4>
                                        <button
                                            type="button"
                                            onClick={addFastDefectRow}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.85rem',
                                                backgroundColor: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontWeight: 700
                                            }}
                                        >
                                            <Plus size={16} /> Agregar Defecto
                                        </button>
                                    </div>

                                    {fastDefects.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {fastDefects.map((defect, index) => (
                                                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', gap: '1rem', alignItems: 'center' }}>
                                                    {defect.isNewCustom ? (
                                                        <input
                                                            type="text"
                                                            placeholder="Escribe nuevo defecto..."
                                                            value={defect.name}
                                                            onChange={(e) => handleFastDefectChange(index, 'name', e.target.value)}
                                                            autoFocus
                                                            style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem' }}
                                                        />
                                                    ) : (
                                                        <select
                                                            value={defect.name}
                                                            onChange={(e) => handleFastDefectChange(index, 'name', e.target.value)}
                                                            required
                                                            style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', background: 'white' }}
                                                        >
                                                            <option value="">Seleccione Defecto</option>
                                                            {availableDefectNames.map((name, i) => (
                                                                <option key={i} value={name}>{name}</option>
                                                            ))}
                                                            <option value="OTRO_CUSTOM_OP" style={{ fontWeight: 'bold', color: '#0ea5e9' }}>+ Agregar Otro Nuevo...</option>
                                                        </select>
                                                    )}

                                                    <input
                                                        type="number"
                                                        placeholder="Cant."
                                                        value={defect.count}
                                                        onChange={(e) => handleFastDefectChange(index, 'count', e.target.value)}
                                                        required
                                                        min="0"
                                                        style={{ padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', textAlign: 'center' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFastDefectRow(index)}
                                                        style={{ background: '#fee2e2', border: 'none', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            No se han agregado defectos específicos a esta muestra.
                                        </div>
                                    )}

                                    <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#334155' }}>Trozos sin defecto:</span>
                                        <span style={{
                                            backgroundColor: sanosCount > 0 ? '#dcfce7' : '#f1f5f9',
                                            padding: '0.5rem 1.5rem',
                                            borderRadius: '100px',
                                            fontSize: '1.2rem',
                                            fontWeight: 900,
                                            color: sanosCount > 0 ? '#166534' : '#64748b',
                                            border: `1px solid ${sanosCount > 0 ? '#bbf7d0' : '#e2e8f0'}`
                                        }}>
                                            {sanosCount}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>

            {/* List / Historic below */}
            {recentInspections.length > 0 && (
                <div style={{ marginTop: '2.5rem', background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={18} /> Últimos Estudios Realizados
                        </h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {recentInspections.map(insp => (
                            <div key={insp.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} title={`Inspector: ${insp.responsible}`}>
                                <div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>{insp.bin_number}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {formatSpanishDate(insp.date)} &bull; {insp.shift} &bull; <Tag size={12} /> {insp.wood_type || 'Sin tipo'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate(`/process/log-quality/report/${insp.id}`)}
                                    style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    Ver <ChevronRight size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogQualityControl;
