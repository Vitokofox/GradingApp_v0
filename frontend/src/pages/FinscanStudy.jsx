
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    getScannerSteps, createScannerStep, getScannerStep, addScannerItem, getScannerStats,
    getProducts, getGradesByProduct, getCatalogItems, getMarkets
} from '../api';
import {
    Plus, Search, BarChart2, CheckCircle2, AlertTriangle, XCircle,
    ArrowRight, Save, Database, Activity, RefreshCw, Printer
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
        <div className="ga-page">
            <header className="ga-card u-mb-6" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', background: 'var(--ga-bg)', backdropFilter: 'blur(10px)' }}>
                <div>
                    <h1 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem' }}>
                        <Activity className="text-pink-400" size={32} />
                        Estudio Finscan
                    </h1>
                    <p className="u-muted">Comparativa de clasificación: Scanner vs Inspector</p>
                </div>
                <div className="u-flex u-gap-2 print:hidden">
                    {view === 'active' && (
                        <button
                            onClick={() => window.print()}
                            className="ga-btn ga-btn--outline"
                        >
                            <Printer size={20} /> <span style={{ marginLeft: '0.5rem' }}>Imprimir</span>
                        </button>
                    )}
                    {view !== 'list' && (
                        <button onClick={() => setView('list')} className="ga-btn ga-btn--text">
                            Volver a Lista
                        </button>
                    )}
                    {view === 'active' && (
                        <button
                            onClick={() => setView('list')}
                            className="ga-btn ga-btn--success"
                            style={{ boxShadow: '0 4px 14px 0 rgba(0,0,0,0.3)' }}
                        >
                            <CheckCircle2 size={20} /> <span style={{ marginLeft: '0.5rem' }}>Finalizar Estudio</span>
                        </button>
                    )}
                    {view === 'list' && (
                        <button
                            onClick={() => setView('create')}
                            className="ga-btn ga-btn--accent"
                        >
                            <Plus size={20} /> <span style={{ marginLeft: '0.5rem' }}>Nuevo Estudio</span>
                        </button>
                    )}
                </div>
            </header>

            <AnimatePresence mode="wait">
                {view === 'list' && (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="ga-stack"
                    >
                        {studies.map(study => (
                            <div key={study.id} className="ga-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.2s' }}>
                                <div>
                                    <h3 className="ga-card__title">{study.product_name}</h3>
                                    <div className="u-flex u-gap-4 u-muted u-mt-2" style={{ fontSize: '0.875rem' }}>
                                        <span>📅 {new Date(study.date).toLocaleDateString()}</span>
                                        <span>👤 {study.responsible}</span>
                                        <span>🏭 {study.shift}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setActiveStudy(study); setView('active'); }}
                                    className="ga-btn ga-btn--outline ga-btn--sm"
                                >
                                    Abrir
                                </button>
                            </div>
                        ))}
                        {studies.length === 0 && (
                            <div className="u-center u-muted u-p-8 u-italic">No hay estudios registrados</div>
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
            className="ga-card"
            style={{ maxWidth: '700px', margin: '0 auto' }}
        >
            <div className="ga-card__header">
                <h2 className="ga-card__title">Configurar Nuevo Estudio</h2>
            </div>
            <div className="ga-card__body">
                <form onSubmit={handleSubmit} className="ga-stack">
                    <div className="ga-card" style={{ background: 'var(--ga-bg)', padding: '1rem' }}>
                        <h3 className="u-bold u-muted u-mb-4" style={{ fontSize: '0.875rem', textTransform: 'uppercase' }}>Datos Generales</h3>
                        <div className="ga-grid ga-grid--2">
                            <SelectField label="Mercado" name="market_id" value={form.market_id} onChange={(v) => setForm({ ...form, market_id: v })} options={masterData.markets} valueKey="id" />
                            <SelectField label="Producto" name="product_name" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} options={masterData.products} valueKey="name" />
                            <SelectField label="Turno" name="shift" value={form.shift} onChange={(v) => setForm({ ...form, shift: v })} options={masterData.shifts} valueKey="name" />
                            <SelectField label="Area" name="area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} options={masterData.areas} valueKey="name" />
                            <SelectField label="Máquina" name="machine" value={form.machine} onChange={(v) => setForm({ ...form, machine: v })} options={masterData.machines} valueKey="name" />
                            <SelectField label="Supervisor" name="supervisor" value={form.supervisor} onChange={(v) => setForm({ ...form, supervisor: v })} options={masterData.supervisors} valueKey="name" />
                        </div>
                    </div>

                    <div className="ga-card" style={{ background: 'var(--ga-bg)', padding: '1rem' }}>
                        <h3 className="u-bold u-mb-2" style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--ga-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Database size={16} /> Dimensiones por Defecto
                        </h3>
                        <p className="u-muted u-mb-4" style={{ fontSize: '0.75rem' }}>Configura esto para acelerar la carga de piezas.</p>
                        <div className="ga-grid ga-grid--3">
                            <InputField label="Espesor (mm)" type="number" value={form.default_thickness} onChange={(v) => setForm({ ...form, default_thickness: v })} />
                            <InputField label="Ancho (mm)" type="number" value={form.default_width} onChange={(v) => setForm({ ...form, default_width: v })} />
                            <InputField label="Largo (mm)" type="number" value={form.default_length} onChange={(v) => setForm({ ...form, default_length: v })} />
                        </div>
                    </div>

                    <div>
                        <label className="ga-label">Responsable</label>
                        <input className="ga-control" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
                    </div>

                    <div className="u-flex u-gap-4 u-mt-4" style={{ justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onCancel} className="ga-btn ga-btn--text">Cancelar</button>
                        <button type="submit" className="ga-btn ga-btn--primary">Crear Estudio</button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
}

function SelectField({ label, name, value, onChange, options, valueKey = 'id' }) {
    return (
        <div>
            <label className="ga-label">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="ga-select"
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
            <label className="ga-label">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="ga-control"
            />
        </div>
    );
}

function ActiveStudyView({ study, stats, grades, currentItem, setCurrentItem, onAddItem, lastAdded, masterData }) {
    // Sort items latest first
    const items = [...(study.items || [])].sort((a, b) => b.id - a.id);

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ga-stack">
            {/* Stats Cards */}
            <div className="ga-grid ga-grid--4">
                <StatCard label="Piezas Evaluadas" value={stats?.pieces_evaluated || 0} icon={<Database className="text-blue-400" />} />
                <StatCard label="Asertividad" value={((stats?.assertiveness || 0) * 100).toFixed(1) + '%'} icon={<CheckCircle2 className="text-emerald-400" />} color="bg-emerald-500/10 text-emerald-400" />
                <StatCard label="Sobre Grado" value={stats?.pieces_over_grade || 0} subValue={((stats?.pieces_over_grade / (stats?.pieces_evaluated || 1)) * 100).toFixed(1) + '%'} icon={<AlertTriangle className="text-amber-400" />} color="bg-amber-500/10 text-amber-400" />
                <StatCard label="Bajo Grado" value={stats?.pieces_under_grade || 0} subValue={((stats?.pieces_under_grade / (stats?.pieces_evaluated || 1)) * 100).toFixed(1) + '%'} icon={<XCircle className="text-red-400" />} color="bg-red-500/10 text-red-400" />
            </div>

            <div className="ga-grid" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '1.5rem' }}>
                {/* Input Section */}
                <div className="ga-card print:hidden" style={{ height: 'fit-content' }}>
                    <div className="ga-card__header">
                        <h3 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus className="text-emerald-400" size={20} /> Ingreso de Pieza
                        </h3>
                    </div>

                    <div className="ga-card__body ga-stack">
                        <div className="u-center u-bold u-mono u-p-4" style={{ fontSize: '2rem', background: 'var(--ga-bg)', borderRadius: 'var(--ga-radius-md)' }}>
                            #{currentItem.item_number}
                        </div>

                        <div className="u-mb-2">
                            <label className="ga-label u-uppercase">Dimensiones</label>
                            <div className="ga-grid ga-grid--2">
                                <input
                                    type="number" placeholder="Espesor"
                                    className="ga-control u-center"
                                    value={currentItem.thickness} onChange={e => setCurrentItem({ ...currentItem, thickness: e.target.value })}
                                />
                                <input
                                    type="number" placeholder="Ancho"
                                    className="ga-control u-center"
                                    value={currentItem.width} onChange={e => setCurrentItem({ ...currentItem, width: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="u-mb-2">
                            <label className="ga-label u-uppercase">Largo</label>
                            {masterData && masterData.lengths && masterData.lengths.length > 0 ? (
                                <div className="ga-grid ga-grid--3" style={{ gap: '0.5rem' }}>
                                    {masterData.lengths.map(l => (
                                        <button
                                            key={l.id}
                                            onClick={() => setCurrentItem({ ...currentItem, length: l.name })}
                                            className={`ga-btn ga-btn--sm ${parseFloat(currentItem.length) === parseFloat(l.name) ? 'ga-btn--primary' : 'ga-btn--outline'}`}
                                            style={{ justifyContent: 'center' }}
                                        >
                                            {l.name}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    className="ga-control u-center"
                                    placeholder="Largo mm"
                                    value={currentItem.length} onChange={e => setCurrentItem({ ...currentItem, length: e.target.value })}
                                />
                            )}
                        </div>

                        <div className="u-mb-2">
                            <label className="ga-label u-uppercase" style={{ color: 'var(--ga-info)' }}>Clasificación Inspector</label>
                            <div className="ga-grid ga-grid--2" style={{ gap: '0.5rem' }}>
                                {grades.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setCurrentItem({ ...currentItem, inspector_grade_id: g.id })}
                                        className={`ga-btn ga-btn--sm ${currentItem.inspector_grade_id === g.id ? 'ga-btn--info' : 'ga-btn--outline'}`}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="u-pt-4" style={{ borderTop: '1px solid var(--ga-border)' }}>
                            <label className="ga-label u-uppercase" style={{ color: 'var(--ga-accent)' }}>Clasificación Scanner</label>
                            <div className="ga-grid ga-grid--2" style={{ gap: '0.5rem' }}>
                                {grades.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={() => setCurrentItem({ ...currentItem, scanner_grade_id: g.id })}
                                        className={`ga-btn ga-btn--sm ${currentItem.scanner_grade_id === g.id ? 'ga-btn--accent' : 'ga-btn--outline'}`}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={onAddItem}
                            disabled={!currentItem.inspector_grade_id || !currentItem.scanner_grade_id}
                            className="ga-btn ga-btn--primary ga-btn--lg u-mt-4"
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            Registrar Pieza
                        </button>
                    </div>
                </div>

                {/* List Section */}
                <div className="ga-card print:col-span-3">
                    <div className="ga-card__header">
                        <h3 className="ga-card__title">Registro Detallado</h3>
                    </div>
                    <div className="ga-table-container">
                        <table className="ga-table">
                            <thead>
                                <tr>
                                    <th className="u-left">#</th>
                                    <th className="u-center">Dimensiones</th>
                                    <th className="u-center">Inspector</th>
                                    <th className="u-center">Scanner</th>
                                    <th className="u-right">Resultado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => {
                                    const inspectorRank = item.inspector_grade?.grade_rank || 0;
                                    const scannerRank = item.scanner_grade?.grade_rank || 0;
                                    let status = "En Grado";
                                    let statusColor = "var(--ga-success)";

                                    if (scannerRank < inspectorRank) { status = "Sobre Grado"; statusColor = "var(--ga-warning)"; }
                                    if (scannerRank > inspectorRank) { status = "Bajo Grado"; statusColor = "var(--ga-danger)"; }

                                    return (
                                        <tr key={item.id}>
                                            <td className="u-mono u-muted">#{item.item_number}</td>
                                            <td className="u-center u-muted" style={{ fontSize: '0.75rem' }}>
                                                {item.thickness}x{item.width}x{item.length}
                                            </td>
                                            <td className="u-center u-bold" style={{ color: 'var(--ga-info)' }}>{item.inspector_grade?.name}</td>
                                            <td className="u-center u-bold" style={{ color: 'var(--ga-accent)' }}>{item.scanner_grade?.name}</td>
                                            <td className="u-right u-bold" style={{ color: statusColor }}>{status}</td>
                                        </tr>
                                    );
                                })}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="u-center u-muted u-italic u-p-6">Esperando datos...</td>
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

function StatCard({ label, value, subValue, icon, color = "var(--ga-text)" }) {
    return (
        <div className="ga-card" style={{ padding: '1.5rem', height: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span className="u-uppercase u-bold u-muted" style={{ fontSize: '0.75rem' }}>{label}</span>
                <span style={{ padding: '0.5rem', background: 'var(--ga-bg)', borderRadius: '8px' }}>{icon}</span>
            </div>
            <div>
                <div style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{value}</div>
                {subValue && <div className="u-muted" style={{ fontSize: '0.875rem' }}>{subValue}</div>}
            </div>
        </div>
    );
}
