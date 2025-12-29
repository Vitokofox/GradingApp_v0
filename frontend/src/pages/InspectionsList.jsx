import { useState, useEffect } from 'react';
import { getInspectionsList, downloadInspectionsCsv, deleteInspection } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Calendar, User, Search, Eye, Download, Filter, X, Trash2, Edit, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EditInspectionModal from '../components/EditInspectionModal';

export default function InspectionsList() {
    const [inspections, setInspections] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState(null);

    // Filter States
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

    const navigate = useNavigate();
    const { user } = useAuth(); // Get current user for permissions

    useEffect(() => {
        loadInspections();
    }, []);

    const loadInspections = async () => {
        try {
            const data = await getInspectionsList();
            setInspections(data);
        } catch (error) {
            console.error("Error loading inspections", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar esta inspección? Esta acción no se puede deshacer.")) {
            try {
                await deleteInspection(id);
                loadInspections();
            } catch (error) {
                console.error("Error creating inspection", error);
                alert("Error al eliminar la inspección.");
            }
        }
    };

    const handleDownload = async () => {
        const filters = {};
        if (startDate) filters.start_date = startDate;
        if (endDate) filters.end_date = endDate;
        if (typeFilter !== 'all') filters.type = typeFilter;

        await downloadInspectionsCsv(filters);
    };

    const getTypeLabel = (type) => {
        const map = {
            'finished_product': 'Producto Terminado',
            'line_grading': 'Clasificación en Línea',
            'rejection_typing': 'Tipificación Rechazo',
            'study': 'Estudio Escáner'
        };
        return map[type] || type;
    };

    const filteredInspections = inspections
        .filter(i => {
            // Text Search
            const matchesSearch = i.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (i.lot && i.lot.toLowerCase().includes(searchTerm.toLowerCase()));

            // Date Filter
            const dateMatches = (!startDate || i.date >= startDate) &&
                (!endDate || i.date <= endDate);

            // Type Filter
            const typeMatches = typeFilter === 'all' || i.type === typeFilter;

            return matchesSearch && dateMatches && typeMatches;
        })

        .sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

    return (
        <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <ClipboardList className="w-8 h-8 text-emerald-400" />
                        Historial de Inspecciones
                    </h1>
                    <p className="text-slate-400">Registro completo de actividades realizadas</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${showFilters ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                        <Filter className="w-4 h-4" /> Filtros
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Exportar CSV
                    </button>
                    <button
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                        title={sortOrder === 'desc' ? "Más recientes primero" : "Más antiguos primero"}
                    >
                        {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 overflow-hidden"
                    >
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Desde</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white p-2 rounded text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Hasta</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 text-white p-2 rounded text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Tipo</label>
                                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-white p-2 rounded text-sm w-48">
                                    <option value="all">Todos</option>
                                    <option value="finished_product">Producto Terminado</option>
                                    <option value="line_grading">Clasificación en Línea</option>
                                    <option value="rejection_typing">Tipificación Rechazo</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Buscar</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por producto..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <button onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); setSearchTerm(''); }} className="p-2 text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {filteredInspections.length > 0 ? (
                    filteredInspections.map((insp) => (
                        <motion.div
                            key={insp.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-800 transition-colors gap-4 group"
                        >
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-slate-600 text-sm">#{insp.id}</span>
                                    <h3 className="text-lg font-bold text-white">{insp.product_name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${insp.type === 'rejection_typing' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
                                        insp.type === 'line_grading' ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' :
                                            'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                        }`}>
                                        {getTypeLabel(insp.type)}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-400">
                                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {insp.date}</span>
                                    <span className="bg-slate-900 px-2 py-0.5 rounded text-xs border border-slate-700">Lote: {insp.lot || 'N/A'}</span>
                                    <span className="flex items-center gap-1"><User className="w-4 h-4" /> {insp.responsible || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full md:w-auto">
                                <div className="text-right flex-1 md:flex-none">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Piezas</div>
                                    <div className="text-xl font-mono text-emerald-400">{insp.pieces_inspected}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (insp.type === 'line_grading') {
                                                navigate(`/inspections/${insp.id}/inline-report`);
                                            } else if (insp.type === 'finished_product') {
                                                navigate(`/inspections/${insp.id}/finished-report`);
                                            } else {
                                                navigate(`/inspections/${insp.id}/report`);
                                            }
                                        }}
                                        className="px-4 py-2 bg-slate-700 hover:bg-white hover:text-black rounded-lg transition-all flex items-center gap-2 text-sm font-semibold"
                                    >
                                        <Eye className="w-4 h-4" /> Ver
                                    </button>
                                    {user && user.level === 'admin' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setSelectedInspection(insp);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-2 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                title="Editar (Solo Admin)"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(insp.id)}
                                                className="p-2 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                title="Eliminar (Solo Admin)"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        No se encontraron inspecciones que coincidan con los filtros.
                    </div>
                )}
            </div>

            <EditInspectionModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                inspection={selectedInspection}
                onUpdate={loadInspections}
            />
        </div>
    );
}
