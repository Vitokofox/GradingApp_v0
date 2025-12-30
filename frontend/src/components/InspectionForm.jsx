import { useState, useEffect } from 'react';
import {
    getMarkets, createInspection,
    getCatalogItems, getProducts
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Briefcase, Settings, Hash, Layout, MapPin, Tag, Box, PlayCircle } from 'lucide-react';

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
        date: new Date().toISOString().split('T')[0],
        production_date: new Date().toISOString().split('T')[0],
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
                alert(`Faltan campos obligatorios: ${missing.join(', ')}`);
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
                    <div className="ga-badge ga-badge--ok">
                        ID: AUTO
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
                                {renderInput("Lote", "lot", "text", <Tag size={14} />)}
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
