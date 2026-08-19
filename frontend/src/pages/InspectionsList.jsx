import { useState, useEffect, useRef } from 'react';

import { getInspectionsList, getBrokenPieceStudies, downloadInspectionDetailsCsv, deleteInspection, importInspections } from '../api';
import { ClipboardList, Calendar, User, Search, Eye, Download, Filter, X, Trash2, Edit, ArrowUp, ArrowDown, Upload, AlertTriangle } from 'lucide-react';
import { formatSpanishDate } from '../utils/dataUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EditInspectionModal from '../components/EditInspectionModal';
import QualityAlertModal from '../components/QualityAlertModal';

export default function InspectionsList() {
    const [inspections, setInspections] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedInspection, setSelectedInspection] = useState(null);
    const [alertInspection, setAlertInspection] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc');

    const navigate = useNavigate();
    const { user } = useAuth();
    const fileInputRef = useRef(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (!json.inspections || !Array.isArray(json.inspections)) {
                    alert("Formato de archivo inválido.");
                    return;
                }

                if (!window.confirm(`¿Importar ${json.inspections.length} inspecciones?`)) return;

                setIsLoading(true);
                const result = await importInspections(json);
                alert(`Importación completada: ${result.imported} registros.`);
                loadInspections();
            } catch (error) {
                console.error("Import error", error);
                alert("Error al importar: " + error.message);
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    useEffect(() => {
        loadInspections();
    }, []);

    const loadInspections = async () => {
        setIsLoading(true);
        setFetchError(null);
        try {
            let insps = [];
            let broken = [];
            let errMessage = null;

            try {
                if (typeof getInspectionsList === 'function') {
                    insps = await getInspectionsList();
                }
            } catch (e) {
                console.error("Error fetching inspections:", e);
                errMessage = "Error cargando alertas.";
            }

            try {
                if (typeof getBrokenPieceStudies === 'function') {
                    broken = await getBrokenPieceStudies();
                }
            } catch (e) {
                console.error("Error fetching broken pieces:", e);
            }

            const safeInspections = Array.isArray(insps) ? insps : [];
            const safeBrokenStudies = Array.isArray(broken) ? broken : [];

            const normalizedStudies = safeBrokenStudies.map(s => ({
                id: s.id,
                date: s.date,
                product_name: 'Estudio Piezas Quebradas',
                lot: 'Total Lotes: ' + (s.lots ? s.lots.length : 0),
                type: 'broken_pieces_study',
                pieces_inspected: s.total_pieces || 0,
                responsible: s.responsible || 'N/A',
                loss_percentage: s.total_loss_percentage || 0,
                loss_m3: s.total_loss_m3 || 0
            }));

            const merged = [...safeInspections, ...normalizedStudies];
            setInspections(merged);

            if (merged.length === 0 && errMessage) {
                setFetchError(errMessage);
            }
        } catch (error) {
            console.error("Critical loader error", error);
            setFetchError("Error crítico al inicializar.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar esta inspección?")) {
            try {
                await deleteInspection(id);
                loadInspections();
            } catch (error) {
                alert("Error al eliminar.");
            }
        }
    };

    const handleDownload = () => {
        downloadInspectionDetailsCsv({
            start_date: startDate,
            end_date: endDate,
            type: typeFilter !== 'all' ? typeFilter : undefined,
            search: searchTerm
        });
    };

    const getTypeLabel = (type) => {
        const map = {
            'finished_product': 'Producto Terminado',
            'line_grading': 'Clasificación en Línea',
            'rejection_typing': 'Tipificación Rechazo',
            'study': 'Estudio Escáner',
            'broken_pieces_study': 'Piezas Quebradas'
        };
        return map[type] || type || 'Inspección';
    };

    const safeDate = (dateStr) => {
        return formatSpanishDate(dateStr);
    };

    const filteredInspections = inspections
        .filter(i => {
            if (!i) return false;
            const pName = i.product_name || '';
            const lotName = i.lot || '';
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = pName.toLowerCase().includes(searchLower) ||
                lotName.toLowerCase().includes(searchLower);

            const dateMatches = (!startDate || i.date >= startDate) &&
                (!endDate || i.date <= endDate);

            const typeMatches = typeFilter === 'all' || i.type === typeFilter;

            return matchesSearch && dateMatches && typeMatches;
        })
        .sort((a, b) => {
            const idA = parseInt(a.id) || 0;
            const idB = parseInt(b.id) || 0;
            return sortOrder === 'asc' ? idA - idB : idB - idA;
        });

    return (
        <div className="ga-page ga-stack">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                style={{ display: 'none' }}
            />
            <div className="ga-card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="ga-card__title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem' }}>
                        <ClipboardList size={24} /> Historial de Inspecciones
                    </h1>
                </div>
                <div className="u-flex u-gap-2">
                    <button
                        onClick={handleImportClick}
                        className="ga-btn ga-btn--secondary"
                        title="Importar desde Archivo Móvil"
                    >
                        <Upload size={16} /> Importar
                    </button>
                    <button onClick={() => setShowFilters(!showFilters)} className={'ga-btn ' + (showFilters ? 'ga-btn--primary' : 'ga-btn--outline')}>
                        <Filter size={16} /> Filtros
                    </button>
                    <button onClick={handleDownload} className="ga-btn ga-btn--accent">
                        <Download size={16} /> CSV
                    </button>
                    <button onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')} className="ga-btn ga-btn--outline">
                        {sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="ga-card u-mb-4">
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
                                    <option value="broken_pieces_study">Piezas Quebradas</option>
                                </select>
                            </div>
                            <div>
                                <label className="ga-label">Buscar</label>
                                <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="ga-control" />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); setTypeFilter('all'); setSearchTerm('') }}
                                    className="ga-btn ga-btn--outline ga-btn--sm"
                                    style={{ color: 'var(--ga-danger)', borderColor: 'var(--ga-danger)' }}
                                >
                                    Limpiar Filtros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="ga-stack" style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading ? (
                    <div className="ga-card u-center u-p-6">Cargando...</div>
                ) : fetchError ? (
                    <div className="ga-card u-center u-p-6 u-color-danger">{fetchError} <button onClick={loadInspections}>X</button></div>
                ) : filteredInspections.length > 0 ? (
                    filteredInspections.map((insp) => (
                        <div
                            key={(insp.type || 'chk') + '-' + (insp.id || Math.random())}
                            className="ga-card"
                            style={{
                                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', flexWrap: 'wrap', gap: '1rem',
                                borderLeft: '4px solid var(--ga-' + (insp.type === 'rejection_typing' || insp.type === 'broken_pieces_study' ? 'danger' : insp.type === 'line_grading' ? 'primary' : 'success') + ')'
                            }}
                        >
                            <div style={{ flex: 1, minWidth: '200px' }}>
                                <div className="u-flex u-gap-2" style={{ alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span className="ga-badge ga-badge--muted">{insp.id}</span>
                                    <h3 className="u-bold" style={{ fontSize: '1.125rem' }}>{insp.product_name || 'Item'}</h3>
                                    <span className="ga-badge">{getTypeLabel(insp.type)}</span>
                                    {insp.quality_alert && <span className="ga-badge ga-badge--warn">Alerta de calidad</span>}
                                </div>
                                <div className="u-flex u-gap-4 u-muted" style={{ fontSize: '0.875rem' }}>
                                    <span><Calendar size={14} /> {safeDate(insp.date)}</span>
                                    <span>Lote: {insp.lot || '-'}</span>
                                    <span><User size={14} /> {insp.responsible || '-'}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                    {insp.type === 'broken_pieces_study' ? (
                                        <div className="u-bold u-color-danger">{(insp.loss_percentage * 100).toFixed(1)}%</div>
                                    ) : (
                                        <div className="u-bold u-color-success">{insp.pieces_inspected} pzs</div>
                                    )}
                                </div>
                                <div className="u-flex u-gap-2">
                                    {insp.quality_alert && (
                                        <button onClick={() => setAlertInspection(insp)} className="ga-btn ga-btn--outline ga-btn--sm" title="Ver alerta de calidad">
                                            <AlertTriangle size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => {
                                        const route = insp.type === 'broken_pieces_study' ? '/process/broken-pieces/report/' + insp.id :
                                            insp.type === 'line_grading' ? '/inspections/' + insp.id + '/inline-report' :
                                                insp.type === 'finished_product' ? '/inspections/' + insp.id + '/finished-report' :
                                                    '/inspections/' + insp.id + '/report';
                                        navigate(route);
                                    }} className="ga-btn ga-btn--outline ga-btn--sm"><Eye size={16} /></button>

                                    {user && user.level === 'admin' && insp.type !== 'broken_pieces_study' && (
                                        <>
                                            <button onClick={() => { setSelectedInspection(insp); setIsEditModalOpen(true); }} className="ga-btn ga-btn--outline ga-btn--sm"><Edit size={16} /></button>
                                            <button onClick={() => handleDelete(insp.id)} className="ga-btn ga-btn--primary ga-btn--sm" style={{ background: 'var(--ga-danger)' }}><Trash2 size={16} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="ga-card u-center u-p-6">No se encontraron registros.</div>
                )}
            </div>

            <EditInspectionModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} inspection={selectedInspection} onUpdate={loadInspections} />
            {alertInspection && <QualityAlertModal inspection={alertInspection} onClose={() => setAlertInspection(null)} />}
        </div>
    );
}
