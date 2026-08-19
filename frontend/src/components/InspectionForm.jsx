import { useState, useEffect } from 'react';
import {
    getMarkets, createInspection,
    getCatalogItems, getProducts
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Briefcase, Settings, Hash, Layout, MapPin, Tag, Box, PlayCircle } from 'lucide-react';
import { getLocalISODate } from '../utils/dataUtils';

export default function InspectionForm({ type, title }) {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Listas
    const [shifts, setShifts] = useState([]);
    const [journeys, setJourneys] = useState([]);
    const [areas, setAreas] = useState([]);
    const [machines, setMachines] = useState([]);
    const [markets, setMarkets] = useState([]);
    const [products, setProducts] = useState([]);
    const [states, setStates] = useState([]);
    const [terminations, setTerminations] = useState([]);
    const [origins, setOrigins] = useState([]);

    const [supervisors, setSupervisors] = useState([]);

    const [formData, setFormData] = useState({
        date: getLocalISODate(),
        production_date: getLocalISODate(),
        shift: '',
        journey: '',
        supervisor: '',
        responsible: '',
        area: '',
        machine: '',
        market_id: '',
        product_name: '',
        state: '',
        termination: '',
        origin: '',
        lot: '',
        thickness: '',
        width: '',
        length: '',
        pieces_inspected: 0,
        type: type
    });

    const [inspectionSubtype, setInspectionSubtype] = useState(null); // 'lote' o 'linea'


    useEffect(() => {
        const loadData = async () => {
            try {
                const [
                    shiftsData, journeysData, areasData, machinesData,
                    marketsData, productsData, statesData, terminationsData, originsData, supervisorsData
                ] = await Promise.all([
                    getCatalogItems('shift'), getCatalogItems('journey'),
                    getCatalogItems('area'), getCatalogItems('machine'),
                    getMarkets(), getProducts(),
                    getCatalogItems('state'), getCatalogItems('termination'),
                    getCatalogItems('origin'), getCatalogItems('supervisor')
                ]);

                setShifts(shiftsData);
                setJourneys(journeysData);
                setAreas(areasData);
                setMachines(machinesData);
                setMarkets(marketsData);
                setProducts(productsData);
                setStates(statesData);
                setTerminations(terminationsData);
                setOrigins(originsData);
                setSupervisors(supervisorsData);

            } catch (error) {
                console.error("Error creating inspection", error);
            }
        };

        loadData();

        if (user) {
            setFormData(prev => ({
                ...prev,
                responsible: `${user.first_name} ${user.last_name}`
            }));
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Validar campos requeridos
            const required = ['date', 'production_date', 'shift', 'journey', 'supervisor', 'responsible', 'area', 'machine', 'origin', 'lot', 'market_id', 'product_name', 'state', 'termination', 'thickness', 'width', 'length', 'pieces_inspected'];
            const missing = required.filter(k => !formData[k]);
            if (missing.length > 0) {
                // Si falta el lote pero es terminado en línea y no se ha seleccionado stacker, avisar específicamente
                const isStackerMissing = missing.includes('lot') && type === 'finished_product' && inspectionSubtype === 'linea';
                if (isStackerMissing) {
                    alert('Debe seleccionar el Stacker (1 o 2) donde se realizó el estudio.');
                } else {
                    alert(`Faltan campos obligatorios: ${missing.join(', ')}`);
                }
                
                // Enfocar automáticamente el primer campo faltante
                const firstMissing = missing[0];
                const element = document.getElementsByName(firstMissing)[0];
                if (element) {
                    element.focus();
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            // Preparar datos con tipos correctos
            const submissionData = {
                ...formData,
                inspection_subtype: type === 'finished_product'
                    ? (inspectionSubtype === 'lote' ? 'finished_lot' : 'finished_line')
                    : type === 'line_grading' ? 'line_grading' : null,
                market_id: parseInt(formData.market_id),
                pieces_inspected: parseInt(formData.pieces_inspected)
            };

            const response = await createInspection(submissionData);
            // Navegar a la Interfaz de Clasificación con el ID de Inspección
            // Asumiendo que la ruta usa ID de inspección para contextualizar
            navigate(`/process/${type.replace('_', '-')}/${response.id}/grading`, {
                state: { inspection: response }
            });

        } catch (error) {
            console.error(error);
            const detail = error.response?.data?.detail;
            const errorMsg = typeof detail === 'object' ? JSON.stringify(detail, null, 2) : (detail || error.message);
            alert(`Error al registrar la inspección: ${errorMsg}`);
        }
    };

    // Ayudante para Selects
    const renderSelect = (label, name, options, icon = null, optionsLabelKey = 'name') => (
        <div>
            <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {icon && <span className="u-muted">{icon}</span>}
                {label}
            </label>
            <select
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="ga-control"
            >
                <option value="">Seleccionar...</option>
                {options.map(opt => (
                    <option key={opt.id} value={opt[optionsLabelKey] || opt.name}>{opt.name}</option>
                ))}
            </select>
        </div>
    );

    const renderInput = (label, name, type = "text", icon = null, placeholder = '') => (
        <div>
            <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {icon && <span className="u-muted">{icon}</span>}
                {label}
            </label>
            <input
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="ga-control"
                placeholder={placeholder}
            />
        </div>
    );

    // Si es producto terminado y no se ha seleccionado el subtipo, mostrar el selector galáctico
    if (type === 'finished_product' && !inspectionSubtype) {
        return (
            <div style={{ maxWidth: '800px', margin: '4rem auto' }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ga-card"
                    style={{ padding: '3rem', textAlign: 'center' }}
                >
                    <h2 className="u-bold u-mb-2" style={{ fontSize: '2rem', color: 'var(--ga-primary)' }}>Tipo de Inspección</h2>
                    <p className="u-muted u-mb-8">Seleccione la modalidad de inspección para comenzar</p>

                    <div className="ga-grid ga-grid--2" style={{ gap: '2rem' }}>
                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setInspectionSubtype('lote');
                                setFormData(p => ({ ...p, lot: '' }));
                            }}
                            className="ga-btn"
                            style={{
                                height: 'auto',
                                padding: '2.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1.5rem',
                                background: 'white',
                                border: '2px solid var(--ga-border)',
                                color: 'var(--ga-text)',
                                borderRadius: '1rem'
                            }}
                        >
                            <div style={{ background: '#eff6ff', color: '#2563eb', padding: '1rem', borderRadius: '50%' }}>
                                <Tag size={40} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Terminado Lote</div>
                                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Paquete tarjeteado y enzunchado con lote obligatorio.</div>
                            </div>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                setInspectionSubtype('linea');
                                setFormData(p => ({ ...p, lot: '' }));
                            }}
                            className="ga-btn"
                            style={{
                                height: 'auto',
                                padding: '2.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1.5rem',
                                background: 'white',
                                border: '2px solid var(--ga-border)',
                                color: 'var(--ga-text)',
                                borderRadius: '1rem'
                            }}
                        >
                            <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '1rem', borderRadius: '50%' }}>
                                <Layout size={40} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Terminado en Línea</div>
                                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Revisión de piezas sueltas en línea (Stacker 1 o 2).</div>
                            </div>
                        </motion.button>
                    </div>
                    
                    <button 
                        onClick={() => navigate('/')} 
                        className="ga-btn ga-btn--text u-mt-8"
                        style={{ color: '#64748b' }}
                        type="button"
                    >
                        Cancelar y Volver
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="ga-card"
            >
                <div className="ga-card__header">
                    <h2 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="ga-badge ga-badge--muted">
                            <Briefcase size={20} />
                        </span>
                        {title} - Nueva Inspección
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {type === 'finished_product' && inspectionSubtype && (
                            <button
                                type="button"
                                onClick={() => setInspectionSubtype(null)}
                                className="ga-btn ga-btn--text"
                                style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', padding: '0.25rem 0.5rem' }}
                            >
                                Cambiar Tipo ({inspectionSubtype === 'lote' ? 'Lote' : 'En Línea'})
                            </button>
                        )}
                        <div className="ga-badge ga-badge--ok">
                            ID: AUTO
                        </div>
                    </div>
                </div>

                <div className="ga-card__body">
                    <form onSubmit={handleSubmit} className="ga-stack">
                        {/* Sección 1: Información Básica */}
                        <div className="ga-card" style={{ background: 'var(--ga-bg)', padding: '1rem' }}>
                            <h3 className="u-bold u-muted u-mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', textTransform: 'uppercase' }}>
                                I. Datos Generales
                            </h3>
                            <div className="ga-grid ga-grid--3">
                                {renderInput("Fecha Inspección", "date", "date", <Calendar size={14} />)}
                                {renderInput("Fecha Producción", "production_date", "date", <Calendar size={14} />)}
                                {renderSelect("Turno", "shift", shifts, <Clock size={14} />)}
                                {renderSelect("Jornada", "journey", journeys, <Clock size={14} />)}

                                {renderSelect("Supervisor", "supervisor", supervisors, <User size={14} />)}

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <User size={14} className="u-muted" /> Responsable
                                    </label>
                                    <input
                                        value={formData.responsible}
                                        name="responsible"
                                        onChange={handleChange}
                                        className="ga-control"
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sección 2: Ubicación y Contexto */}
                        <div className="ga-card" style={{ background: 'var(--ga-bg)', padding: '1rem' }}>
                            <h3 className="u-bold u-muted u-mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', textTransform: 'uppercase' }}>
                                II. Ubicación y Origen
                            </h3>
                            <div className="ga-grid ga-grid--3">
                                {renderSelect("Área", "area", areas, <MapPin size={14} />)}
                                {renderSelect("Máquina", "machine", machines, <Settings size={14} />)}
                                {renderSelect("Origen", "origin", origins, <MapPin size={14} />)}
                            </div>
                        </div>

                        {/* Sección 3: Detalles del Material */}
                        <div className="ga-card" style={{ background: 'var(--ga-bg)', padding: '1rem' }}>
                            <h3 className="u-bold u-muted u-mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', textTransform: 'uppercase' }}>
                                III. Detalles del Material
                            </h3>
                            <div className="ga-grid ga-grid--3">
                                {renderSelect("Mercado", "market_id", markets, <Briefcase size={14} />, 'id')}
                                {renderSelect("Producto", "product_name", products, <Box size={14} />, 'name')}
                                
                                {type === 'finished_product' && inspectionSubtype === 'linea' ? (
                                    <div>
                                        <label className="ga-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <Layout size={14} className="u-muted" /> Stacker
                                        </label>
                                        <select
                                            name="lot"
                                            value={formData.lot}
                                            onChange={handleChange}
                                            className="ga-control"
                                        >
                                            <option value="">Seleccionar Stacker...</option>
                                            <option value="Stacker 1">Stacker 1</option>
                                            <option value="Stacker 2">Stacker 2</option>
                                        </select>
                                    </div>
                                ) : (
                                    renderInput("Lote", "lot", "text", <Tag size={14} />)
                                )}

                                {renderSelect("Estado", "state", states, <Layout size={14} />)}
                                {renderSelect("Terminación", "termination", terminations, <Layout size={14} />)}
                            </div>

                            <div className="ga-grid ga-grid--3" style={{ marginTop: '1rem' }}>
                                {renderInput("Espesor (mm)", "thickness", "number", <Hash size={14} />)}
                                {renderInput("Ancho (mm)", "width", "number", <Hash size={14} />)}
                                {renderInput("Largo (mm)", "length", "number", <Hash size={14} />)}
                            </div>
                        </div>

                        {/* Sección 4: Configuración */}
                        <div className="ga-alert ga-alert--success">
                            <div className="ga-stack" style={{ width: '100%' }}>
                                <h3 className="u-bold" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--ga-success)' }}>
                                    IV. Configuración de Muestra
                                </h3>
                                <div className="ga-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    {renderInput("Cantidad de Piezas a Inspeccionar", "pieces_inspected", "number", <Hash size={14} />)}
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            className="ga-btn ga-btn--primary"
                            style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', padding: '1rem', marginTop: '1rem' }}
                        >
                            <PlayCircle size={20} />
                            Iniciar Proceso de Inspección
                        </motion.button>

                    </form>
                </div>
            </motion.div>
        </div>
    );
};
