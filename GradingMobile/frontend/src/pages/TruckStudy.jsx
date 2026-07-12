import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, Calendar, Hash, Tag, User,
    Plus, Check, FileText, AlertCircle, Trash2, Download
} from 'lucide-react';
import {
    createTruckStudy, getTruckStudies, getCatalogItems, downloadTruckStudiesCsv, deleteTruckStudy, getTruckStudyReport
} from '../api';
import { useAuth } from '../context/AuthContext';

const TruckStudy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [recentStudies, setRecentStudies] = useState([]);
    const [reportData, setReportData] = useState(null);

    // Catalog data for dropdowns
    const [estates, setEstates] = useState([]);
    const [characteristics, setCharacteristics] = useState([]);
    const [loggingTeams, setLoggingTeams] = useState([]);

    const [formData, setFormData] = useState({
        reception_date: new Date().toISOString().split('T')[0],
        cutting_date: new Date().toISOString().split('T')[0],
        guide_number: '',
        estate: '',
        logging_team: '',
        total_logs: '',
        responsible: '',
        defects: [] // Array of { defect_name: '', count: '' }
    });

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                responsible: user.first_name ? `${user.first_name} ${user.last_name || ''}` : (user.username || 'Admin')
            }));
        }
        loadInitialData();
    }, [user]);

    const loadInitialData = async () => {
        try {
            const studies = await getTruckStudies().catch(() => []);
            const est = await getCatalogItems('estate').catch(() => []);
            const char = await getCatalogItems('characteristic').catch(() => []);
            const team = await getCatalogItems('logging_team').catch(() => []);
            const report = await getTruckStudyReport().catch(() => null);

            setRecentStudies(Array.isArray(studies) ? studies.slice(0, 10) : []);
            setEstates(Array.isArray(est) ? est : []);
            // Filter out 'Sin defecto' if it exists in DB, as we'll calculate it
            setCharacteristics(Array.isArray(char) ? char.filter(c => c.name.toLowerCase() !== 'sin defecto') : []);
            setLoggingTeams(Array.isArray(team) ? team : []);
            setReportData(report);
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const addDefectRow = () => {
        setFormData(prev => ({
            ...prev,
            defects: [...prev.defects, { defect_name: '', count: '' }]
        }));
    };

    const removeDefectRow = (index) => {
        setFormData(prev => ({
            ...prev,
            defects: prev.defects.filter((_, i) => i !== index)
        }));
    };

    const handleDefectChange = (index, field, value) => {
        setFormData(prev => {
            const newDefects = [...prev.defects];
            newDefects[index] = { ...newDefects[index], [field]: value };
            return { ...prev, defects: newDefects };
        });
    };

    const calculateSinDefecto = () => {
        const total = parseInt(formData.total_logs) || 0;
        const sumDefects = formData.defects.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0);
        return Math.max(0, total - sumDefects);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este registro?')) return;

        try {
            await deleteTruckStudy(id);
            setMessage({ type: 'success', text: 'Registro eliminado correctamente' });
            loadInitialData();
        } catch (error) {
            console.error("Error deleting:", error);
            setMessage({ type: 'error', text: 'Error al eliminar el registro' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const total = parseInt(formData.total_logs) || 0;
        const sumDefects = formData.defects.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0);

        if (sumDefects > total) {
            setMessage({ type: 'error', text: 'La suma de defectos no puede ser mayor al total de trozos' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await createTruckStudy({
                ...formData,
                total_logs: total,
                defects: formData.defects.map(d => ({
                    defect_name: d.defect_name,
                    count: parseInt(d.count) || 0
                }))
            });
            setMessage({ type: 'success', text: 'Estudio guardado correctamente' });
            setFormData(prev => ({
                ...prev,
                guide_number: '',
                total_logs: '',
                defects: []
            }));
            loadInitialData();
        } catch (error) {
            const errorMsg = error.response?.data?.detail
                ? (typeof error.response.data.detail === 'string'
                    ? error.response.data.detail
                    : JSON.stringify(error.response.data.detail))
                : 'Error al conectar con el servidor o validar datos';
            setMessage({ type: 'error', text: `Error: ${errorMsg}` });
            console.error("DEBUG TruckStudy Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: 'var(--ga-primary, #0056b3)',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Activity size={32} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>
                            ESTUDIO CAMIÓN
                        </h1>
                        <p style={{ margin: 0, color: '#666' }}>Registro de recepción y características de carga</p>
                    </div>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Form Column */}
                <div className="ga-card" style={{ padding: '1.5rem', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Nuevo Registro</h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                    <Calendar size={14} style={{ marginRight: '0.25rem' }} /> Fecha Recepción
                                </label>
                                <input
                                    type="date"
                                    name="reception_date"
                                    value={formData.reception_date}
                                    onChange={handleChange}
                                    className="ga-control"
                                    required
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                    <Calendar size={14} style={{ marginRight: '0.25rem' }} /> Fecha Corte
                                </label>
                                <input
                                    type="date"
                                    name="cutting_date"
                                    value={formData.cutting_date}
                                    onChange={handleChange}
                                    className="ga-control"
                                    required
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                <Hash size={14} style={{ marginRight: '0.25rem' }} /> N° de Guía
                            </label>
                            <input
                                type="text"
                                name="guide_number"
                                value={formData.guide_number}
                                onChange={handleChange}
                                className="ga-control"
                                placeholder="Ej: 12345"
                                required
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                <Tag size={14} style={{ marginRight: '0.25rem' }} /> Predio
                            </label>
                            <select
                                name="estate"
                                value={formData.estate}
                                onChange={handleChange}
                                required
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                            >
                                <option value="">Seleccione Predio</option>
                                {(estates || []).map(item => (
                                    <option key={item.id} value={item.name}>{item.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                    <User size={14} style={{ marginRight: '0.25rem' }} /> Equipo Maderero
                                </label>
                                <select
                                    name="logging_team"
                                    value={formData.logging_team}
                                    onChange={handleChange}
                                    required
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                >
                                    <option value="">Seleccione Equipo</option>
                                    {(loggingTeams || []).map(item => (
                                        <option key={item.id} value={item.name}>{item.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem' }}>
                                    <Hash size={14} style={{ marginRight: '0.25rem' }} /> Total Trozos
                                </label>
                                <input
                                    type="number"
                                    name="total_logs"
                                    value={formData.total_logs}
                                    onChange={handleChange}
                                    placeholder="Cant. total..."
                                    required
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        {/* Defects Section */}
                        <div style={{ backgroundColor: '#fdfdfd', border: '1px dashed #ddd', padding: '1rem', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>Defectos / Características</h4>
                                <button
                                    type="button"
                                    onClick={addDefectRow}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}
                                >
                                    <Plus size={14} /> Agregar Defecto
                                </button>
                            </div>

                            {formData.defects.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {formData.defects.map((defect, index) => (
                                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 40px', gap: '0.5rem', alignItems: 'center' }}>
                                            <select
                                                value={defect.defect_name}
                                                onChange={(e) => handleDefectChange(index, 'defect_name', e.target.value)}
                                                required
                                                style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                                            >
                                                <option value="">Seleccione Defecto</option>
                                                {characteristics.map(item => (
                                                    <option key={item.id} value={item.name}>{item.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="Cant."
                                                value={defect.count}
                                                onChange={(e) => handleDefectChange(index, 'count', e.target.value)}
                                                required
                                                style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeDefectRow(index)}
                                                style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', margin: '0.5rem 0' }}>No se han agregado defectos específicos.</p>
                            )}

                            <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Sin defecto (automático):</span>
                                <span style={{
                                    backgroundColor: '#e9ecef',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '12px',
                                    fontSize: '0.9rem',
                                    fontWeight: 'bold',
                                    color: calculateSinDefecto() > 0 ? 'var(--ga-primary)' : '#666'
                                }}>
                                    {calculateSinDefecto()}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                            {message && (
                                <div style={{
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    borderRadius: '4px',
                                    backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                                    color: message.type === 'success' ? '#155724' : '#721c24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
                                    {message.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '1rem',
                                    backgroundColor: 'var(--ga-primary, #0056b3)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {loading ? 'Guardando...' : <><Check size={20} /> Guardar Estudio</>}
                            </button>
                        </div>
                    </form>
                </div>

                {/* List Column */}
                <div className="ga-card" style={{ padding: '1.5rem', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0 }}><FileText size={18} style={{ marginRight: '0.5rem' }} /> Historial Reciente</h3>
                        <button
                            onClick={() => downloadTruckStudiesCsv()}
                            style={{
                                background: 'none',
                                border: '1px solid #0056b3',
                                color: '#0056b3',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.75rem'
                            }}
                        >
                            <Download size={14} /> Descargar
                        </button>
                    </div>

                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {(!recentStudies || recentStudies.length === 0) ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                                No hay estudios registrados aún.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: '#f8f9fa' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Fecha/Guía</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Predio</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Cant.</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentStudies.map(study => (
                                        <tr key={study.id}>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                                                <div style={{ fontWeight: 'bold' }}>{new Date(study.reception_date).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#666' }}>Guía: {study.guide_number}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                                                <div>{study.estate}</div>
                                                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>
                                                    {study.logging_team} | {study.defects?.map(d => `${d.defect_name}: ${d.count}`).join(', ')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                                                <span style={{ backgroundColor: '#e9ecef', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                    {Number(study.total_logs).toLocaleString()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => navigate(`/process/truck-study/report/${study.id}`)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: 'var(--ga-primary)',
                                                            cursor: 'pointer',
                                                            padding: '0.25rem'
                                                        }}
                                                        title="Ver Reporte Individual"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(study.id)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#dc3545',
                                                            cursor: 'pointer',
                                                            padding: '0.25rem'
                                                        }}
                                                        title="Eliminar Registro"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Report Section */}
            <div className="ga-card" style={{ marginTop: '2rem', padding: '1.5rem', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    <Activity size={18} style={{ marginRight: '0.5rem' }} /> Distribución por Característica / Defecto
                </h3>

                {(!reportData || !reportData.breakdown || reportData.breakdown.length === 0) ? (
                    <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay datos suficientes para generar el gráfico.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {reportData.breakdown.map((item, idx) => (
                            <div key={idx}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                                    <span>
                                        <b style={{ color: 'var(--ga-primary)' }}>{item.count}</b> trozos
                                        <span style={{ marginLeft: '1rem', color: '#666' }}>({item.percentage}%)</span>
                                    </span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '24px',
                                    backgroundColor: '#f0f2f5',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{
                                        width: `${item.percentage}%`,
                                        height: '100%',
                                        backgroundColor: item.name.toLowerCase() === 'sin defecto' ? '#28a745' : 'var(--ga-primary, #0056b3)',
                                        background: item.name.toLowerCase() === 'sin defecto'
                                            ? 'linear-gradient(90deg, #28a745, #34ce57)'
                                            : 'linear-gradient(90deg, #0056b3, #007bff)',
                                        transition: 'width 1s ease-in-out',
                                        borderRadius: '12px'
                                    }} />
                                </div>
                            </div>
                        ))}

                        <div style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            textAlign: 'right',
                            fontSize: '0.9rem',
                            borderLeft: '4px solid var(--ga-primary)'
                        }}>
                            Total Muestra: <b>{reportData.total_logs} trozos</b>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TruckStudy;
