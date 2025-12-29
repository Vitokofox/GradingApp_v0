import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                >
                    <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-900/50 flex-none">
                        <h2 className="text-xl font-bold text-white">Editar Inspección #{inspection?.id}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        {error && (
                            <div className="bg-red-500/20 text-red-300 p-3 rounded flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <h3 className="text-lg font-bold text-emerald-400 border-b border-slate-700 pb-2">Información General</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Producto</label>
                                    <input
                                        type="text"
                                        value={formData.product_name}
                                        onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Lote</label>
                                    <input
                                        type="text"
                                        value={formData.lot}
                                        onChange={e => setFormData({ ...formData, lot: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Responsable</label>
                                    <input
                                        type="text"
                                        value={formData.responsible}
                                        onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Supervisor</label>
                                    <input
                                        type="text"
                                        value={formData.supervisor}
                                        onChange={e => setFormData({ ...formData, supervisor: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Turno</label>
                                    <input
                                        type="text"
                                        value={formData.shift}
                                        onChange={e => setFormData({ ...formData, shift: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Jornada</label>
                                    <input
                                        type="text"
                                        value={formData.journey}
                                        onChange={e => setFormData({ ...formData, journey: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 text-sm font-bold mb-1">Area</label>
                                    <input
                                        type="text"
                                        value={formData.area}
                                        onChange={e => setFormData({ ...formData, area: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Encabezado</>}
                                </button>
                            </div>
                        </form>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                                <h3 className="text-lg font-bold text-purple-400">Resultados y Conteos</h3>
                                <button onClick={() => setExpandedResults(!expandedResults)} className="text-slate-400 hover:text-white">
                                    {expandedResults ? <ChevronUp /> : <ChevronDown />}
                                </button>
                            </div>

                            {loadingResults ? <div className="text-center text-slate-500">Cargando resultados...</div> : (
                                <div className="grid grid-cols-1 gap-2">
                                    {results.map(r => (
                                        <div key={r.id} className="bg-slate-900/50 p-3 rounded flex items-center justify-between border border-slate-700">
                                            <div className="flex items-center gap-4">
                                                <div className="w-24 text-sm font-bold text-slate-300">{r.grade?.name}</div>
                                                <div className="text-sm text-slate-400">{r.defect?.name || 'Sin Defecto (Base)'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={r.pieces_count}
                                                    onChange={(e) => handleResultChange(r.id, e.target.value)}
                                                    className={`w-20 bg-slate-800 border ${r.isDirty ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-slate-600'} rounded p-1 text-white text-center text-sm`}
                                                />
                                                {r.isDirty && (
                                                    <button
                                                        onClick={() => saveResult(r)}
                                                        className="p-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
                                                        title="Guardar cambio"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {results.length === 0 && <div className="text-slate-500 text-sm">No hay resultados registrados.</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
