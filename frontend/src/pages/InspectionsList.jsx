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
        <div className="ga-page ga-stack">
            {/* Header / Actions Bar */}
            <div className="ga-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
                        <span className="ga-badge ga-badge--ok">
                            <ClipboardList size={24} />
                        </span>
                        Historial de Inspecciones
                    </h1>
                    <p className="u-muted">Registro completo de actividades realizadas</p>
                </div>

                <div className="u-flex u-gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`ga-btn ${showFilters ? 'ga-btn--primary' : 'ga-btn--outline'}`}
                    >
                        <Filter size={16} /> <span style={{ marginLeft: '0.5rem' }}>Filtros</span>
                    </button>
                    <button
                        onClick={handleDownload}
                        className="ga-btn ga-btn--accent"
                    >
                        <Download size={16} /> <span style={{ marginLeft: '0.5rem' }}>Exportar CSV</span>
                    </button>
                    <button
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="ga-btn ga-btn--outline"
                        title={sortOrder === 'desc' ? "Más recientes primero" : "Más antiguos primero"}
                    >
                        {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
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
                        className="ga-card u-mb-4"
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="ga-card__body">
                            <div className="ga-grid ga-grid--4" style={{ alignItems: 'end' }}>
                                <div>
                                    <label className="ga-label">Desde</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="ga-control" />
                                </div>
                                <div>
                                    <label className="ga-label">Hasta</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="ga-control" />
                                </div>
                                <div>
                                    <label className="ga-label">Tipo</label>
                                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="ga-control">
                                        <option value="all">Todos</option>
                                        <option value="finished_product">Producto Terminado</option>
                                        <option value="line_grading">Clasificación en Línea</option>
                                        <option value="rejection_typing">Tipificación Rechazo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="ga-label">Buscar</label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ga-muted)' }} />
                                        <input
                                            type="text"
                                            placeholder="Buscar por producto..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="ga-control"
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); setSearchTerm(''); }}
                                        className="ga-btn ga-btn--text u-muted"
                                        title="Limpiar filtros"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List */}
            <div className="ga-stack" style={{ flex: 1, overflowY: 'auto' }}>
                {filteredInspections.length > 0 ? (
                    filteredInspections.map((insp) => (
                        <motion.div
                            key={insp.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="ga-card"
                            style={{
                                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', flexWrap: 'wrap', gap: '1rem',
                                borderLeft: `4px solid var(--ga-${insp.type === 'rejection_typing' ? 'danger' : insp.type === 'line_grading' ? 'primary' : 'success'})`
                            }}
                        >
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div className="u-flex u-gap-2" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span className="ga-badge ga-badge--muted">#{insp.id}</span>
                                    <h3 className="u-bold" style={{ fontSize: '1.125rem' }}>{insp.product_name}</h3>
                                    <span className={`ga-badge ga-badge--${insp.type === 'rejection_typing' ? 'danger' : insp.type === 'line_grading' ? 'primary' : 'ok'}`}>
                                        {getTypeLabel(insp.type)}
                                    </span>
                                </div>
                                <div className="u-flex u-gap-4 u-muted" style={{ fontSize: '0.875rem', flexWrap: 'wrap' }}>
                                    <span className="u-flex u-center-y u-gap-2"><Calendar size={14} /> {insp.date}</span>
                                    <span style={{ padding: '2px 6px', background: 'var(--ga-bg)', borderRadius: '4px', border: '1px solid var(--ga-border)' }}>Lote: {insp.lot || 'N/A'}</span>
                                    <span className="u-flex u-center-y u-gap-2"><User size={14} /> {insp.responsible || 'N/A'}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div className="u-text-xs u-bold u-muted u-uppercase">Piezas</div>
                                    <div className="u-mono u-bold" style={{ fontSize: '1.25rem', color: 'var(--ga-success)' }}>{insp.pieces_inspected}</div>
                                </div>
                                <div className="u-flex u-gap-2">
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
                                        className="ga-btn ga-btn--outline ga-btn--sm"
                                    >
                                        <Eye size={16} /> <span style={{ marginLeft: '0.5rem' }}>Ver</span>
                                    </button>
                                    {user && user.level === 'admin' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setSelectedInspection(insp);
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="ga-btn ga-btn--outline ga-btn--sm"
                                                title="Editar (Solo Admin)"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(insp.id)}
                                                className="ga-btn ga-btn--primary ga-btn--sm"
                                                title="Eliminar (Solo Admin)"
                                                style={{ background: 'var(--ga-danger)', borderColor: 'var(--ga-danger)' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="ga-card u-center u-p-6">
                        <p className="u-muted">No se encontraron inspecciones que coincidan con los filtros.</p>
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
