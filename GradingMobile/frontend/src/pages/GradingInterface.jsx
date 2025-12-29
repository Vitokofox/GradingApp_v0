import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInspection, getGradesByProduct, addInspectionResult, getProducts, getInspectionResults, syncInspectionResults } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, Activity, Database, ChevronRight, X, RotateCcw, Home, Search, Save, Menu, BarChart2, List } from 'lucide-react';

export default function GradingInterface() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [inspection, setInspection] = useState(null);
    const [grades, setGrades] = useState([]);
    const [stats, setStats] = useState({});
    const [countLog, setCountLog] = useState([]);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [autoFill, setAutoFill] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [activeTab, setActiveTab] = useState('grading'); // 'grading', 'stats', 'details'
    const [loading, setLoading] = useState(true);

    // Derived state
    const totalInspected = Object.values(stats).reduce((acc, curr) => acc + curr.total, 0);

    useEffect(() => {
        loadContext();
    }, [id]);

    const loadContext = async () => {
        setLoading(true);
        try {
            const insp = await getInspection(id);
            setInspection(insp);

            // Fetch grades for the product
            let productGrades = [];
            let targetProductId = insp.product_id;

            if (!targetProductId && insp.product_name) {
                try {
                    const allProducts = await getProducts();
                    const foundProduct = allProducts.find(p => p.name === insp.product_name);
                    if (foundProduct) {
                        targetProductId = foundProduct.id;
                    }
                } catch (e) {
                    console.error("Error fetching products to find ID", e);
                }
            }

            if (targetProductId) {
                console.log("Fetching grades for product ID:", targetProductId);
                productGrades = await getGradesByProduct(targetProductId);
                console.log("Fetched grades:", productGrades);
            } else {
                console.warn("No product_id found for inspection", insp);
            }
            setGrades(productGrades || []);

            // Initialize Stats
            const initialStats = {};
            (productGrades || []).forEach(g => {
                initialStats[g.id] = {
                    name: g.name,
                    total: 0,
                    defects: {}
                };
            });

            // Load existing results
            const results = await getInspectionResults(id);
            results.forEach(r => {
                if (initialStats[r.grade_id]) {
                    initialStats[r.grade_id].total += r.pieces_count;
                    if (r.defect_id) {
                        initialStats[r.grade_id].defects[r.defect_id] = (initialStats[r.grade_id].defects[r.defect_id] || 0) + r.pieces_count;
                    }
                }
            });

            setStats(initialStats);

        } catch (error) {
            console.error("Error loading context", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGrading = async (grade, defect = null) => {
        if (showFinishModal) return;

        // Optimistic UI update
        const newStats = { ...stats };
        newStats[grade.id].total += 1;
        if (defect) {
            newStats[grade.id].defects[defect.id] = (newStats[grade.id].defects[defect.id] || 0) + 1;
        }
        setStats(newStats);

        const currentTotal = Object.values(newStats).reduce((acc, curr) => acc + curr.total, 0);

        setCountLog(prev => [{
            time: new Date(),
            gradeName: grade.name,
            gradeId: grade.id,
            defectName: defect?.name || 'Clean',
            defectId: defect?.id || null,
            id: Date.now()
        }, ...prev].slice(0, 50));

        if (defect) {
            setSelectedGrade(null);
            setSearchTerm('');
        }

        if (inspection && currentTotal >= inspection.pieces_inspected) {
            setShowFinishModal(true);
        }
    };

    const handleSaveInspection = async () => {
        const resultsToSync = [];
        Object.keys(stats).forEach(gradeIdStr => {
            const gradeId = parseInt(gradeIdStr);
            const stat = stats[gradeId];
            const totalDefects = Object.values(stat.defects).reduce((a, b) => a + b, 0);
            const cleanCount = Math.max(0, stat.total - totalDefects);

            if (cleanCount > 0) {
                resultsToSync.push({ grade_id: gradeId, defect_id: null, pieces_count: cleanCount });
            }
            Object.keys(stat.defects).forEach(defectIdStr => {
                const defectId = parseInt(defectIdStr);
                const count = stat.defects[defectId];
                if (count > 0) {
                    resultsToSync.push({ grade_id: gradeId, defect_id: defectId, pieces_count: count });
                }
            });
        });

        try {
            await syncInspectionResults(id, resultsToSync);
            alert("Inspección guardada correctamente.");
        } catch (error) {
            console.error("Save error", error);
            alert("Error al guardar la inspección.");
        }
    };

    const handleFinish = async () => {
        if (autoFill && baseGrade) {
            const remaining = Math.max(0, inspection.pieces_inspected - totalInspected);
            if (remaining > 0) {
                try {
                    await addInspectionResult(id, baseGrade.id, null, remaining);
                } catch (e) {
                    console.error("Autofill error", e);
                }
            }
        }
        await handleSaveInspection();
        navigate('/');
    };

    const remainingPieces = inspection ? Math.max(0, inspection.pieces_inspected - totalInspected) : 0;

    const handleUndo = async () => {
        if (showFinishModal) setShowFinishModal(false);
        const lastAction = countLog[0];
        if (!lastAction) return;

        const newStats = { ...stats };
        if (newStats[lastAction.gradeId]) {
            newStats[lastAction.gradeId].total = Math.max(0, newStats[lastAction.gradeId].total - 1);
            if (lastAction.defectId) {
                newStats[lastAction.gradeId].defects[lastAction.defectId] = Math.max(0, (newStats[lastAction.gradeId].defects[lastAction.defectId] || 0) - 1);
            }
        }
        setStats(newStats);
        setCountLog(prev => prev.slice(1));
    };

    const baseGrade = grades.length > 0 ? grades[0] : null;
    const downgradeGrades = grades
        .slice(1)
        .map(grade => {
            if (!searchTerm) return grade;
            const gradeMatches = grade.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchingDefects = grade.defects?.filter(d =>
                d.name.toLowerCase().includes(searchTerm.toLowerCase())
            ) || [];
            if (gradeMatches) return grade;
            if (matchingDefects.length > 0) return { ...grade, defects: matchingDefects };
            return null;
        })
        .filter(Boolean);

    if (loading) return <div className="flex items-center justify-center h-screen text-white">Cargando...</div>;
    if (!inspection) return <div className="flex items-center justify-center h-screen text-white">Error: Inspección no encontrada</div>;

    // Empty State Check
    if (grades.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-6 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">No hay grados configurados</h2>
                <p className="text-slate-400 mb-6">
                    No se encontraron grados para el producto "{inspection.product_name}".
                    Verifique que el ID del producto en la hoja "grades" coincida con el ID en "products".
                </p>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-700 rounded-lg">Volver al Inicio</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden relative">
            {/* Completion Modal */}
            <AnimatePresence>
                {showFinishModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-800 border border-emerald-500/50 rounded-3xl p-6 w-full max-w-md text-center shadow-2xl"
                        >
                            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold text-white mb-2">¡Completado!</h2>
                            <p className="text-slate-300 mb-6">Objetivo alcanzado: <span className="text-emerald-400 font-bold">{inspection.pieces_inspected}</span> pzas.</p>

                            {remainingPieces > 0 && baseGrade && (
                                <div className="bg-emerald-900/30 p-4 rounded-xl mb-6 text-left">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoFill}
                                            onChange={e => setAutoFill(e.target.checked)}
                                            className="w-5 h-5 text-emerald-500 rounded bg-slate-800 border-slate-600"
                                        />
                                        <div>
                                            <div className="text-sm font-bold text-emerald-200">Completar Automáticamente</div>
                                            <div className="text-xs text-emerald-400/80">Asignar {remainingPieces} a {baseGrade.name}</div>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <button onClick={handleFinish} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">
                                    Confirmar y Finalizar
                                </button>
                                <button onClick={() => setShowFinishModal(false)} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-bold">
                                    Volver / Corregir
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile Header */}
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    <h1 className="text-lg font-bold truncate">{inspection.product_name}</h1>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 hidden sm:inline-block">{inspection.lot}</span>
                </div>
                <div className="flex items-center gap-2">
                    {countLog.length > 0 && (
                        <button onClick={handleUndo} className="p-2 bg-slate-800 rounded-lg text-slate-300">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={handleSaveInspection} className="p-2 bg-emerald-600 rounded-lg text-white">
                        <Save className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Mobile Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
                <button
                    onClick={() => setActiveTab('grading')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'grading' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}
                >
                    <Activity className="w-4 h-4" /> Clasificar
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}
                >
                    <BarChart2 className="w-4 h-4" /> Estadísticas
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative bg-slate-900">
                {/* Grading Tab */}
                <div className={`absolute inset-0 flex flex-col p-4 overflow-y-auto ${activeTab === 'grading' ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'}`}>
                    {/* Search */}
                    <div className="mb-4 relative shrink-0">
                        <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar defecto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6 bg-slate-800 rounded-full h-4 overflow-hidden shrink-0 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold z-10 text-white drop-shadow-md">
                            {totalInspected} / {inspection.pieces_inspected}
                        </div>
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, (totalInspected / inspection.pieces_inspected) * 100)}%` }} />
                    </div>

                    {/* Main Actions */}
                    <div className="flex-1 flex flex-col gap-4 min-h-0">
                        {/* Base Grade (Big Button) */}
                        {baseGrade && !searchTerm && (
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleGrading(baseGrade)}
                                className="flex-1 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl shadow-lg flex flex-col items-center justify-center border-4 border-emerald-500/30 min-h-[160px]"
                            >
                                <CheckCircle className="w-16 h-16 text-emerald-200 mb-2" />
                                <span className="text-2xl font-bold text-white">{baseGrade.name}</span>
                                <span className="text-emerald-200 text-sm">Sin Defectos</span>
                            </motion.button>
                        )}

                        {/* Downgrades List */}
                        <div className="flex-1 overflow-y-auto space-y-3 pb-20">
                            {downgradeGrades.map(grade => (
                                <div key={grade.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-3 border-b border-slate-700/50 pb-2">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${grade.grade_rank === 2 ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'}`}>
                                            {grade.grade_rank}
                                        </span>
                                        <h3 className="font-bold text-slate-200">{grade.name}</h3>
                                    </div>

                                    {grade.defects && grade.defects.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {grade.defects.map(defect => (
                                                <motion.button
                                                    key={defect.id}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleGrading(grade, defect)}
                                                    className="bg-slate-900 p-3 rounded-lg text-sm font-medium text-slate-300 border border-slate-700 hover:border-purple-500 text-center"
                                                >
                                                    {defect.name}
                                                </motion.button>
                                            ))}
                                        </div>
                                    ) : (
                                        <motion.button
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleGrading(grade)}
                                            className="w-full py-3 bg-slate-700 text-white rounded-lg font-bold"
                                        >
                                            Confirmar {grade.name}
                                        </motion.button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats Tab */}
                <div className={`absolute inset-0 p-4 overflow-y-auto ${activeTab === 'stats' ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'}`}>
                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Resumen de Clasificación</h3>
                    <div className="space-y-3">
                        {Object.values(stats).map((s, idx) => (
                            <div key={idx} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-white">{s.name}</span>
                                    <span className="text-xl font-mono text-emerald-400">{s.total}</span>
                                </div>
                                {Object.keys(s.defects).length > 0 && (
                                    <div className="text-xs text-slate-400 space-y-1 pl-2 border-l-2 border-slate-700">
                                        {Object.entries(s.defects).map(([dId, count]) => (
                                            <div key={dId} className="flex justify-between">
                                                <span>Defecto ID {dId}</span>
                                                <span>{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Historial Reciente</h3>
                        <div className="space-y-2">
                            {countLog.map((log, i) => (
                                <div key={i} className="flex justify-between text-xs py-2 border-b border-slate-800 text-slate-300">
                                    <span>{log.gradeName} {log.defectName !== 'Clean' && `(${log.defectName})`}</span>
                                    <span className="opacity-50">{log.time.toLocaleTimeString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
