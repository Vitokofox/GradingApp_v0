import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, Calendar, Clock, Hash, Tag, User,
    Plus, Check, FileText, AlertCircle, Trash2, Home
} from 'lucide-react';
import {
    createSiniestradaStudy, getSiniestradaStudies, deleteSiniestradaStudy, getCatalogItems
} from '../api';
import { useAuth } from '../context/AuthContext';

const SiniestradaStudy = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [recentStudies, setRecentStudies] = useState([]);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }),
        area: 'Aserradero',
        shift: '',
        journey: '',
        screen: '',
        total_weight: '',
        burnt_bark_weight: '0',
        burnt_cambium_weight: '0',
        burnt_wood_weight: '0',
        soot_chip_weight: '0',
        responsible: ''
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
            const studies = await getSiniestradaStudies().catch(() => []);
            setRecentStudies(Array.isArray(studies) ? studies.slice(0, 10) : []);
        } catch (error) {
            console.error("Error loading data:", error);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const calculatePulpable = () => {
        const total = parseFloat(formData.total_weight) || 0;
        const burnt = (parseFloat(formData.burnt_bark_weight) || 0) +
            (parseFloat(formData.burnt_cambium_weight) || 0) +
            (parseFloat(formData.burnt_wood_weight) || 0) +
            (parseFloat(formData.soot_chip_weight) || 0);
        return Math.max(0, total - burnt).toFixed(4);
    };


    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este registro?')) return;

        try {
            await deleteSiniestradaStudy(id);
            setMessage({ type: 'success', text: 'Registro eliminado correctamente' });
            loadInitialData();
        } catch (error) {
            console.error("Error deleting:", error);
            setMessage({ type: 'error', text: 'Error al eliminar el registro' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const total = parseFloat(formData.total_weight) || 0;
        const pulpable = parseFloat(calculatePulpable());

        if (total <= 0) {
            setMessage({ type: 'error', text: 'El peso total debe ser mayor a 0' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await createSiniestradaStudy({
                ...formData,
                total_weight: total,
                burnt_bark_weight: parseFloat(formData.burnt_bark_weight) || 0,
                burnt_cambium_weight: parseFloat(formData.burnt_cambium_weight) || 0,
                burnt_wood_weight: parseFloat(formData.burnt_wood_weight) || 0,
                soot_chip_weight: parseFloat(formData.soot_chip_weight) || 0,
                pulpable_chip_weight: pulpable
            });

            setMessage({ type: 'success', text: 'Estudio de astilla guardado correctamente' });
            setFormData(prev => ({
                ...prev,
                total_weight: '',
                burnt_bark_weight: '0',
                burnt_cambium_weight: '0',
                burnt_wood_weight: '0',
                soot_chip_weight: '0',
            }));
            loadInitialData();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Error al guardar el estudio';
            setMessage({ type: 'error', text: `Error: ${errorMsg}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <header style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        background: '#e67e22', // Ocre/Naranja para astilla/siniestro
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
                            ESTUDIO ASTILLA SINIESTRADA
                        </h1>
                        <p style={{ margin: 0, color: '#666' }}>Análisis de calidad y porcentajes de astilla recuperable</p>
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
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Fecha</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className="ga-control" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Hora</label>
                                <input type="time" name="time" value={formData.time} onChange={handleChange} required className="ga-control" style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Turno</label>
                                <select name="shift" value={formData.shift} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                    <option value="">Seleccione Turno</option>
                                    <option value="Turno 1">Turno 1</option>
                                    <option value="Turno 2">Turno 2</option>
                                    <option value="Turno 3">Turno 3</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Jornada</label>
                                <select name="journey" value={formData.journey} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                    <option value="">Seleccione Jornada</option>
                                    <option value="Mañana">Mañana</option>
                                    <option value="Tarde">Tarde</option>
                                    <option value="Noche">Noche</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Harnero</label>
                            <select name="screen" value={formData.screen} onChange={handleChange} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
                                <option value="">Seleccione Harnero</option>
                                <option value="Harnero 110">Harnero 110</option>
                                <option value="Harnero 60">Harnero 60</option>
                            </select>
                        </div>

                        <div style={{ backgroundColor: '#fef5e7', padding: '1rem', borderRadius: '8px', border: '1px solid #fbd0a1' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '800', fontSize: '0.9rem', color: '#a04000' }}>
                                <Hash size={14} /> PESO TOTAL MUESTRA (gr)
                            </label>
                            <input
                                type="number"
                                step="any"

                                name="total_weight"
                                value={formData.total_weight}
                                onChange={handleChange}
                                placeholder="Gramos totales..."
                                required
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #fbd0a1', borderRadius: '4px', fontSize: '1.25rem', fontWeight: 'bold' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.75rem' }}>Corteza Quemada (gr)</label>
                                <input type="number" step="any" name="burnt_bark_weight" value={formData.burnt_bark_weight} onChange={handleChange} className="ga-control" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.75rem' }}>Cambium Quemado (gr)</label>
                                <input type="number" step="any" name="burnt_cambium_weight" value={formData.burnt_cambium_weight} onChange={handleChange} className="ga-control" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.75rem' }}>Madera/Manto Quemado (gr)</label>
                                <input type="number" step="any" name="burnt_wood_weight" value={formData.burnt_wood_weight} onChange={handleChange} className="ga-control" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 'bold', fontSize: '0.75rem' }}>Astilla con Hollín (gr)</label>
                                <input type="number" step="any" name="soot_chip_weight" value={formData.soot_chip_weight} onChange={handleChange} className="ga-control" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }} />

                            </div>
                        </div>

                        <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#e8f6f3', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #a2d9ce' }}>
                            <span style={{ fontWeight: '800', color: '#16a085' }}>ASTILLA PULPABLE (gr):</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0e6655' }}>{calculatePulpable()}</span>
                        </div>

                        {message && (
                            <div style={{
                                padding: '0.75rem',
                                borderRadius: '4px',
                                backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
                                color: message.type === 'success' ? '#155724' : '#721c24'
                            }}>
                                {message.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                backgroundColor: '#e67e22',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {loading ? 'Guardando...' : <><Check size={20} /> Guardar Registro</>}
                        </button>
                    </form>
                </div>

                {/* List Column */}
                <div className="ga-card" style={{ padding: '1.5rem', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                        <FileText size={18} style={{ marginRight: '0.5rem' }} /> Historial Reciente
                    </h3>

                    <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {(!recentStudies || recentStudies.length === 0) ? (
                            <p style={{ textAlign: 'center', color: '#888' }}>No hay registros anteriores.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead style={{ backgroundColor: '#f8f9fa' }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Fecha/Hora</th>
                                        <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Harnero</th>
                                        <th style={{ textAlign: 'right', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Total (gr)</th>
                                        <th style={{ textAlign: 'center', padding: '0.75rem', borderBottom: '1px solid #dee2e6' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentStudies.map(study => (
                                        <tr key={study.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ fontWeight: 'bold' }}>{new Date(study.date).toLocaleDateString()}</div>
                                                <div style={{ color: '#666', fontSize: '0.75rem' }}>{study.time} | {study.shift}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '4px',
                                                    backgroundColor: study.screen === 'Harnero 110' ? '#ebf5fb' : '#f4ecf7',
                                                    color: study.screen === 'Harnero 110' ? '#2e86c1' : '#884ea0',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {study.screen}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>
                                                {study.total_weight.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => navigate(`/process/siniestrada-study/report/${study.id}`)}
                                                        className="ga-btn-icon"
                                                        style={{ color: '#e67e22', border: 'none', background: 'none', cursor: 'pointer' }}
                                                        title="Ver Reporte"
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(study.id)}
                                                        className="ga-btn-icon"
                                                        style={{ color: '#dc3545', border: 'none', background: 'none', cursor: 'pointer' }}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
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
        </div>
    );
};

export default SiniestradaStudy;
