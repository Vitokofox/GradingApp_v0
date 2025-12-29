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

    // Lists
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
            // Validate required fields
            const required = ['date', 'production_date', 'shift', 'journey', 'supervisor', 'responsible', 'area', 'machine', 'origin', 'lot', 'market_id', 'product_name', 'state', 'termination', 'thickness', 'width', 'length', 'pieces_inspected'];
            const missing = required.filter(k => !formData[k]);
            if (missing.length > 0) {
                alert(`Faltan campos obligatorios: ${missing.join(', ')}`);
                // Auto-focus the first missing field
                const firstMissing = missing[0];
                const element = document.getElementsByName(firstMissing)[0];
                if (element) {
                    element.focus();
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            // Prepare data with correct types
            const submissionData = {
                ...formData,
                market_id: parseInt(formData.market_id),
                pieces_inspected: parseInt(formData.pieces_inspected)
            };

            const response = await createInspection(submissionData);
            // Navigate to the Grading Interface with the Inspection ID
            // Assuming route uses inspection ID to contextualize
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

    // Helper for Selects
    const renderSelect = (label, name, options, icon = null, optionsLabelKey = 'name') => (
        <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
                {icon && <span className="text-slate-400">{icon}</span>}
                {label}
            </label>
            <select
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
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
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
                {icon && <span className="text-slate-400">{icon}</span>}
                {label}
            </label>
            <input
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                placeholder={placeholder}
            />
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                            <Briefcase className="w-6 h-6" />
                        </span>
                        {title} - Nueva Inspección
                    </h2>
                    <div className="bg-slate-900 px-4 py-2 rounded-lg text-slate-400 text-sm font-mono">
                        ID: <span className="text-emerald-400 font-bold">AUTO</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Basic Info */}
                    <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase flex items-center gap-2">
                            I. Datos Generales
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {renderInput("Fecha Inspección", "date", "date", <Calendar className="w-3 h-3" />)}
                            {renderInput("Fecha Producción", "production_date", "date", <Calendar className="w-3 h-3" />)}
                            {renderSelect("Turno", "shift", shifts, <Clock className="w-3 h-3" />)}
                            {renderSelect("Jornada", "journey", journeys, <Clock className="w-3 h-3" />)}

                            {renderSelect("Supervisor", "supervisor", supervisors, <User className="w-3 h-3" />)}

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1 flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" /> Responsable
                                </label>
                                <input
                                    value={formData.responsible}
                                    name="responsible"
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Location & Context */}
                    <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase flex items-center gap-2">
                            II. Ubicación y Origen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {renderSelect("Área", "area", areas, <MapPin className="w-3 h-3" />)}
                            {renderSelect("Máquina", "machine", machines, <Settings className="w-3 h-3" />)}
                            {renderSelect("Origen", "origin", origins, <MapPin className="w-3 h-3" />)}
                        </div>
                    </div>

                    {/* Section 3: Material Details (The core) */}
                    <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase flex items-center gap-2">
                            III. Detalles del Material
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {renderSelect("Mercado", "market_id", markets, <Briefcase className="w-3 h-3" />, 'id')}

                            {/* Product selection drives cascade in next step */}
                            {renderSelect("Producto", "product_name", products, <Box className="w-3 h-3" />, 'name')}

                            {renderInput("Lote", "lot", "text", <Tag className="w-3 h-3" />)}

                            {renderSelect("Estado", "state", states, <Layout className="w-3 h-3" />)}
                            {renderSelect("Terminación", "termination", terminations, <Layout className="w-3 h-3" />)}
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                            {renderInput("Espesor (mm)", "thickness", "number", <Hash className="w-3 h-3" />)}
                            {renderInput("Ancho (mm)", "width", "number", <Hash className="w-3 h-3" />)}
                            {renderInput("Largo (mm)", "length", "number", <Hash className="w-3 h-3" />)}
                        </div>
                    </div>

                    {/* Section 4: Process Start */}
                    <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-500/20">
                        <h3 className="text-sm font-bold text-emerald-400 mb-4 uppercase flex items-center gap-2">
                            IV. Configuración de Muestra
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            {renderInput("Cantidad de Piezas a Inspeccionar", "pieces_inspected", "number", <Hash className="w-3 h-3" />)}
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"
                    >
                        <PlayCircle className="w-6 h-6" />
                        Iniciar Proceso de Inspección
                    </motion.button>

                </form>
            </motion.div>
        </div>
    );
};
