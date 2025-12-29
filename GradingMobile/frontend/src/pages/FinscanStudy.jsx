
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    getScannerSteps, createScannerStep, getScannerStep, addScannerItem, getScannerStats,
    getProducts, getGradesByProduct, getCatalogItems, getMarkets
} from '../api';
import {
    Plus, Search, BarChart2, CheckCircle2, AlertTriangle, XCircle,
    ArrowRight, Save, Database, Activity, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FinscanStudy() {
    const { user } = useAuth();

    // State
    const [view, setView] = useState('list'); // 'list', 'create', 'active'
    const [studies, setStudies] = useState([]);
    const [activeStudy, setActiveStudy] = useState(null);
    const [stats, setStats] = useState(null);
    const [grades, setGrades] = useState([]); // Grades for the active product

    // Master Data
    const [products, setProducts] = useState([]);
    const [markets, setMarkets] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [areas, setAreas] = useState([]);
    const [machines, setMachines] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [lengths, setLengths] = useState([]);


    // Data Entry State
    const [currentItem, setCurrentItem] = useState({
        item_number: 1,
        inspector_grade_id: '',
        scanner_grade_id: '',
        thickness: '',
        width: '',
        length: ''
    });
    const [lastAdded, setLastAdded] = useState(null);


    // Initial Load
    useEffect(() => {
        loadMasterData();
        loadStudies();
    }, []);

    // Load Grades when Active Study is set
    useEffect(() => {
        if (activeStudy?.product_name && products.length > 0) {
            const product = products.find(p => p.name === activeStudy.product_name);
            if (product) {
                getGradesByProduct(product.id).then(setGrades);
            }
        }
    }, [activeStudy, products]);

    // Load Stats when Active Study changes or item added
    useEffect(() => {
        if (activeStudy) {
            loadStats(activeStudy.id);
        }
    }, [activeStudy, lastAdded]);

    const loadMasterData = async () => {
        const [p, m, s, a, ma, sup, l] = await Promise.all([
            getProducts(), getMarkets(), getCatalogItems('shift'),
            getCatalogItems('area'), getCatalogItems('machine'), getCatalogItems('supervisor'),
            getCatalogItems('length')
        ]);
        setProducts(p);
        setMarkets(m);
        setShifts(s);
        setAreas(a);
        setMachines(ma);
        setSupervisors(sup);
        setLengths(l.sort((a, b) => parseFloat(a.name) - parseFloat(b.name)));
    };

    const loadStudies = async () => {
        const data = await getScannerSteps();
        setStudies(data);
    };

    const loadStats = async (id) => {
        try {
            const s = await getScannerStats(id);
            setStats(s);
            // Also refresh the study to get items list
            const fullStudy = await getScannerStep(id);
            setActiveStudy(fullStudy);

            // Only reset current item if we just added one or loaded fresh
            setCurrentItem(prev => ({
                item_number: fullStudy.items.length + 1,
                inspector_grade_id: '',
                scanner_grade_id: '',
                thickness: fullStudy.default_thickness || '',
                width: fullStudy.default_width || '',
                length: fullStudy.default_length || ''
            }));
        } catch (e) {
            console.error("Error loading stats", e);
        }
    };


    const handleCreateStudy = async (formData) => {
        try {
            const newStudy = await createScannerStep({
                ...formData,
                date: new Date().toISOString()
            });
            await loadStudies();
            setActiveStudy(newStudy);
            setView('active');
        } catch (e) {
            alert("Error creando estudio: " + e.message);
        }
    };

    const handleAddItem = async () => {
        if (!currentItem.inspector_grade_id || !currentItem.scanner_grade_id) return;

        try {
            const added = await addScannerItem(activeStudy.id, currentItem);
            setLastAdded(added);
            setCurrentItem({
                item_number: currentItem.item_number + 1,
                inspector_grade_id: '',
                scanner_grade_id: '' // Keep previous selection? No, reset.
            });
            // Focus inspector input? (Logic handled in UI via ref if needed)
        } catch (e) {
            alert("Error agregando pieza: " + e.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-6">
            <header className="flex justify-between items-center bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-md">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Activity className="w-8 h-8 text-pink-400" />
                        Estudio Finscan
                    </h1>
                    <p className="text-slate-400 mt-1">Comparativa de clasificación: Scanner vs Inspector</p>
                </div>
                <div className="flex justify-end gap-4 print:hidden">
                    {view === 'active' && (
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold flex items-center gap-2"
                        >
                            <span className="text-xl">🖨️</span> Imprimir / Reporte
                        </button>
                    )}
                    {view !== 'list' && (

                        <button onClick={() => setView('list')} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">
                            Volver a Lista
                        </button>
                    )}
                    {view === 'active' && (
                        <button
                            onClick={() => setView('list')}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                            <CheckCircle2 className="w-5 h-5" /> Finalizar Estudio
                        </button>
                    )}
                    {view === 'list' && (

                        <button
                            onClick={() => setView('create')}
                            className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-pink-900/20"
                        >
                            <Plus className="w-5 h-5" /> Nuevo Estudio
                        </button>
                    )}
                </div>
            </header>

            <AnimatePresence mode="wait">
                {view === 'list' && (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-1 gap-4"
                    >
                        {studies.map(study => (
                            <div key={study.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center hover:bg-slate-750 transition-colors">
                                <div>
                                    <h3 className="text-xl font-bold text-white">{study.product_name}</h3>
                                    <div className="flex gap-4 text-sm text-slate-400 mt-2">
                                        <span>📅 {new Date(study.date).toLocaleDateString()}</span>
                                        <span>👤 {study.responsible}</span>
                                        <span>🏭 {study.shift}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setActiveStudy(study); setView('active'); }}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                                >
                                    Abrir
                                </button>
                            </div>
                        ))}
                        {studies.length === 0 && (
                            <div className="text-center py-20 text-slate-500">No hay estudios registrados</div>
                        )}
                    </motion.div>
                )}

                {view === 'create' && (
                    <StudyCreateForm
                        onSubmit={handleCreateStudy}
                        masterData={{ products, markets, shifts, areas, machines, supervisors, lengths }}
                        user={user}
                        onCancel={() => setView('list')}
                    />


                )}

                {view === 'active' && activeStudy && (
                    <ActiveStudyView
                        study={activeStudy}
                        stats={stats}
                        grades={grades}
                        currentItem={currentItem}
                        setCurrentItem={setCurrentItem}
                        onAddItem={handleAddItem}
                        lastAdded={lastAdded}
                        masterData={{ lengths }}
                    />

                )}
            </AnimatePresence>
        </div>
    );
}

function StudyCreateForm({ onSubmit, masterData, user, onCancel }) {
    // Find Cepillado area if exists
    const cepilladoArea = masterData.areas.find(a => a.name.toLowerCase().includes('cepillado'));

    const [form, setForm] = useState({
        market_id: '',
        product_name: '',
        shift: '',
        area: cepilladoArea ? cepilladoArea.name : 'Cepillado',
        machine: '',
        supervisor: '',
        responsible: user ? `${user.first_name} ${user.last_name}` : '',
        default_thickness: '',
        default_width: '',
        default_length: ''
    });



    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(form);
    };

    return (
        <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-slate-800 p-8 rounded-2xl border border-slate-700 max-w-2xl mx-auto"
        >
            <h2 className="text-2xl font-bold text-white mb-6">Configurar Nuevo Estudio</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Datos Generales</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <SelectField label="Mercado" name="market_id" value={form.market_id} onChange={(v) => setForm({ ...form, market_id: v })} options={masterData.markets} valueKey="id" />
                        <SelectField label="Producto" name="product_name" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} options={masterData.products} valueKey="name" />
                        <SelectField label="Turno" name="shift" value={form.shift} onChange={(v) => setForm({ ...form, shift: v })} options={masterData.shifts} valueKey="name" />
                        <SelectField label="Area" name="area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={masterData.areas} valueKey="name" />
                        <SelectField label="Máquina" name="machine" value={form.machine} onChange={(v) => setForm({ ...form, machine: v })} options={masterData.machines} valueKey="name" />
                        <SelectField label="Supervisor" name="supervisor" value={form.supervisor} onChange={(v) => setForm({ ...form, supervisor: v })} options={masterData.supervisors} valueKey="name" />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mb-4">
                    <h3 className="text-sm font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                        <Database className="w-4 h-4" /> Dimensiones por Defecto (Opcional)
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">Configura esto para acelerar la carga de piezas.</p>
                    <div className="grid grid-cols-3 gap-4">
                        <InputField label="Espesor (mm)" type="number" value={form.default_thickness} onChange={(v) => setForm({ ...form, default_thickness: v })} />
                        <InputField label="Ancho (mm)" type="number" value={form.default_width} onChange={(v) => setForm({ ...form, default_width: v })} />
                        <InputField label="Largo (mm)" type="number" value={form.default_length} onChange={(v) => setForm({ ...form, default_length: v })} />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Responsable</label>
                    <input className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onCancel} className="px-6 py-2 text-slate-400 hover:text-white">Cancelar</button>
                    <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">Crear Estudio</button>
                </div>
            </form>
        </motion.div>
    );
}

function SelectField({ label, name, value, onChange, options, valueKey = 'id' }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-emerald-500"
            >
                <option value="">Seleccionar...</option>
                {options.map(o => (
                    <option key={o.id} value={o[valueKey]}>{o.name}</option>
                ))}
            </select>
        </div>
    );
}

function InputField({ label, value, onChange, type = "text" }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
        </div>
    );
}

function ActiveStudyView({ study, stats, grades, currentItem, setCurrentItem, onAddItem, lastAdded, masterData }) {

    // Sort items latest first
    const items = [...(study.items || [])].sort((a, b) => b.id - a.id);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Piezas Evaluadas" value={stats?.pieces_evaluated || 0} icon={<Database className="text-blue-400" />} />
                <StatCard label="Asertividad" value={((stats?.assertiveness || 0) * 100).toFixed(1) + '%'} icon={<CheckCircle2 className="text-emerald-400" />} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard label="Sobre Grado" value={stats?.pieces_over_grade || 0} subValue={((stats?.pieces_over_grade / (stats?.pieces_evaluated || 1)) * 100).toFixed(1) + '%'} icon={<AlertTriangle className="text-amber-400" />} color="bg-amber-500/10 text-amber-400" />
                <StatCard label="Bajo Grado" value={stats?.pieces_under_grade || 0} subValue={((stats?.pieces_under_grade / (stats?.pieces_evaluated || 1)) * 100).toFixed(1) + '%'} icon={<XCircle className="text-red-400" />} color="bg-red-500/10 text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Input Section */}
                <div className="lg:col-span-1 bg-slate-800 p-6 rounded-2xl border border-slate-700 h-fit print:hidden">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-400" /> Ingreso de Pieza
                    </h3>

                    <div className="space-y-4">
                        <div className="text-center font-mono text-4xl text-slate-500 mb-8 bg-slate-900/50 py-4 rounded-lg">
                            #{currentItem.item_number}
                        </div>

                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-bold text-slate-400 uppercase">Dimensiones</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number" placeholder="Espesor"
                                    className="p-2 bg-slate-900 border border-slate-700 rounded text-white text-center"
                                    value={currentItem.thickness} onChange={e => setCurrentItem({ ...currentItem, thickness: e.target.value })}
                                />
                                <input
                                    type="number" placeholder="Ancho"
                                    className="p-2 bg-slate-900 border border-slate-700 rounded text-white text-center"
                                    value={currentItem.width} onChange={e => setCurrentItem({ ...currentItem, width: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Length Selection: Buttons if configured, else Input */}
                        <div className="space-y-2 mb-4">
                            <label className="text-sm font-bold text-slate-400 uppercase">Largo</label>
                            {masterData && masterData.lengths && masterData.lengths.length > 0 ? (
                                <div className="grid grid-cols-3 gap-2">
                                    {masterData.lengths.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setCurrentItem({ ...currentItem, length: l.name })}
                                            className={`p-3 rounded-lg text-sm font-bold transition-all ${parseFloat(currentItem.length) === parseFloat(l.name) ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-white text-center"
                                    placeholder="Largo mm"
                                    value={currentItem.length} onChange={e => setCurrentItem({ ...currentItem, length: e.target.value })}
                                />
                            )}
                        </div>

                        <div className="space-y-2">

                            <label className="text-sm font-bold text-blue-400 uppercase">Clasificación Inspector</label>
                            <div className="grid grid-cols-2 gap-2">
                                {grades.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setCurrentItem({ ...currentItem, inspector_grade_id: g.id })}
                                        className={`p-3 rounded-lg text-sm font-bold transition-all ${currentItem.inspector_grade_id === g.id ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-slate-700">
                            <label className="text-sm font-bold text-pink-400 uppercase">Clasificación Scanner</label>
                            <div className="grid grid-cols-2 gap-2">
                                {grades.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setCurrentItem({ ...currentItem, scanner_grade_id: g.id })}
                                        className={`p-3 rounded-lg text-sm font-bold transition-all ${currentItem.scanner_grade_id === g.id ? 'bg-pink-600 text-white ring-2 ring-pink-300' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={onAddItem}
                            disabled={!currentItem.inspector_grade_id || !currentItem.scanner_grade_id}
                            className="w-full py-4 mt-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            Registrar Pieza
                        </button>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 print:col-span-3 bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-300 mb-4">Registro Detallado</h3>
                    <div className="overflow-hidden rounded-xl border border-slate-700">
                        <table className="w-full text-slate-300">
                            <thead className="bg-slate-800 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-3 text-left">#</th>
                                    <th className="p-3 text-center">Dimensiones</th>
                                    <th className="p-3 text-center">Inspector</th>
                                    <th className="p-3 text-center">Scanner</th>
                                    <th className="p-3 text-right">Resultado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700 text-sm">
                                {items.map(item => {
                                    const isMatch = item.inspector_grade_id === item.scanner_grade_id;
                                    const inspectorRank = item.inspector_grade?.grade_rank || 0;
                                    const scannerRank = item.scanner_grade?.grade_rank || 0;
                                    let status = "En Grado";
                                    let statusColor = "text-emerald-400";

                                    if (scannerRank < inspectorRank) { status = "Sobre Grado"; statusColor = "text-amber-400"; }
                                    if (scannerRank > inspectorRank) { status = "Bajo Grado"; statusColor = "text-red-400"; }

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                                            <td className="p-3 font-mono text-slate-500">#{item.item_number}</td>
                                            <td className="p-3 text-center text-slate-400 text-xs">
                                                {item.thickness}x{item.width}x{item.length}
                                            </td>
                                            <td className="p-3 text-center font-bold text-blue-300">{item.inspector_grade?.name}</td>
                                            <td className="p-3 text-center font-bold text-pink-300">{item.scanner_grade?.name}</td>
                                            <td className={`p-3 text-right font-bold ${statusColor}`}>{status}</td>
                                        </tr>
                                    );

                                })}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-500 italic">Esperando datos...</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function StatCard({ label, value, subValue, icon, color = "bg-slate-800 text-white" }) {
    return (
        <div className={`p-6 rounded-xl border border-slate-700/50 bg-slate-800 flex flex-col justify-between`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-semibold uppercase">{label}</span>
                <span className="p-2 bg-slate-900 rounded-lg">{icon}</span>
            </div>
            <div>
                <div className="text-3xl font-bold text-white">{value}</div>
                {subValue && <div className="text-sm text-slate-500 mt-1">{subValue}</div>}
            </div>
        </div>
    );
}
