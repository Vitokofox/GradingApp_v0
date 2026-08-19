import React, { useState, useEffect } from 'react';
import api, { downloadInspectionsCsv, downloadInspectionDetailsCsv } from '../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';
import { Filter, Globe, Package, Download, Settings, FileText } from 'lucide-react';
import { formatSpanishDate } from '../utils/dataUtils';

// Helper to get grade color matching standard guidelines
const getGradeColor = (gradeName, index) => {
    const name = String(gradeName || '').toUpperCase().trim();
    if (name.includes('RECH') || name.includes('REJ')) return '#5F5953';   // Arauco Gray (Rejection)
    if (name.includes('COL')) return '#00968F';       // Arauco Teal (COL/Premium)
    if (name.includes('COP')) return '#BCC300';       // Arauco Lime (COP/Secondary)
    if (name.includes('COB')) return '#E27000';       // Arauco Orange (COB/Third)
    
    // Fallback to index-based Arauco colors if names are custom
    if (index === 0) return '#00968F';  // Rank 1 -> Arauco Teal
    if (index === 1) return '#BCC300';  // Rank 2 -> Arauco Lime
    if (index === 2) return '#E27000';  // Rank 3 -> Arauco Orange
    return '#5F5953';                  // Rank 4+ -> Arauco Gray
};

// Custom component to render hierarchical X-axis ticks (Month name on first line, Product name centered below)
const CustomXAxisTick = (props) => {
    const { x, y, payload, data } = props;
    if (!payload || payload.value === undefined || payload.value === null || !data || !Array.isArray(data)) return null;
    const valueStr = String(payload.value);
    const parts = valueStr.split('|');
    const product = parts[0] || '';
    const month = parts[1] || '';
    const currentIndex = payload.index;

    // Find all indices of the current product in the sorted data list to calculate middle position
    const groupIndices = [];
    data.forEach((item, idx) => {
        if (item && item.product === product) {
            groupIndices.push(idx);
        }
    });

    const groupSize = groupIndices.length;
    const isMiddleIndex = groupSize > 0 && currentIndex === groupIndices[Math.floor(groupSize / 2)];

    return (
        <g transform={`translate(${x},${y})`}>
            {/* Month label directly below each column */}
            <text x={0} y={15} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="500">
                {month}
            </text>
            
            {/* Product name centered under the group of months */}
            {isMiddleIndex && (
                <text x={0} y={32} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight="bold">
                    {product}
                </text>
            )}
        </g>
    );
};

// Custom component to render segment text labels inside stacked bars if space allows
const renderCustomLabel = (props, gradeName) => {
    if (!props) return null;
    const { x, y, width, height, value } = props;
    // Hide label if the segment is too thin (height < 22px) to prevent text overlap
    if (height < 22 || !value || value === 0) return null;
    
    return (
        <text
            x={x + width / 2}
            y={y + height / 2}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight="bold"
        >
            {gradeName}
        </text>
    );
};

const GlobalReport = () => {
    // Filters State
    const [filters, setFilters] = useState({
        start_date: '',
        end_date: '',
        inspection_type: 'all',
        market_id: '',
        product_name: 'all',
        origin: 'all',
        thickness: 'all',
        process: 'all',
        area: 'all',
        machine: 'all'
    });

    // Master Data State
    const [markets, setMarkets] = useState([]);
    const [products, setProducts] = useState([]);
    const [origins, setOrigins] = useState([]);
    const [thicknesses, setThicknesses] = useState([]);
    const [areas, setAreas] = useState([]);
    const [machines, setMachines] = useState([]);

    // Stats State
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch Master Data on Mount
    useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [
                    marketsRes,
                    productsRes,
                    catalogOriginsRes,
                    distinctOriginsRes,
                    distinctThicknessRes,
                    catalogAreasRes,
                    distinctAreasRes,
                    catalogMachinesRes,
                    distinctMachinesRes
                ] = await Promise.all([
                    api.get('/master-data/markets'),
                    api.get('/master-data/products'),
                    api.get('/master-data/catalogs/origin'),
                    api.get('/api/inspections/distinct/origin'),
                    api.get('/api/inspections/distinct/thickness'),
                    api.get('/master-data/catalogs/area'),
                    api.get('/api/inspections/distinct/area'),
                    api.get('/master-data/catalogs/machine'),
                    api.get('/api/inspections/distinct/machine')
                ]);

                setMarkets(Array.isArray(marketsRes.data) ? marketsRes.data : []);
                setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);

                const catalogOrigins = Array.isArray(catalogOriginsRes.data) ? catalogOriginsRes.data.map(o => o.name) : [];
                const distinctOrigins = Array.isArray(distinctOriginsRes.data) ? distinctOriginsRes.data : [];
                const combinedOrigins = [...new Set([...catalogOrigins, ...distinctOrigins])];
                setOrigins(combinedOrigins.map((name, idx) => ({ id: idx, name })));

                const distinctThicknesses = Array.isArray(distinctThicknessRes.data) ? distinctThicknessRes.data : [];
                const sortedThicknesses = distinctThicknesses
                    .filter(t => t && t !== '-1')
                    .sort((a, b) => parseFloat(a) - parseFloat(b));
                setThicknesses(sortedThicknesses);

                const catalogAreas = Array.isArray(catalogAreasRes.data) ? catalogAreasRes.data.map(a => a.name) : [];
                const distinctAreas = Array.isArray(distinctAreasRes.data) ? distinctAreasRes.data : [];
                const combinedAreas = [...new Set([...catalogAreas, ...distinctAreas])].filter(Boolean);
                setAreas(combinedAreas.map((name, idx) => ({ id: idx, name })));

                const catalogMachines = Array.isArray(catalogMachinesRes.data) ? catalogMachinesRes.data.map(m => m.name) : [];
                const distinctMachines = Array.isArray(distinctMachinesRes.data) ? distinctMachinesRes.data : [];
                const combinedMachines = [...new Set([...catalogMachines, ...distinctMachines])].filter(Boolean);
                setMachines(combinedMachines.map((name, idx) => ({ id: idx, name })));
            } catch (err) {
                console.error("Error fetching master data", err);
            }
        };
        fetchMasterData();
    }, []);

    // Fetch Stats
    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                start_date: filters.start_date || undefined,
                end_date: filters.end_date || undefined,
                inspection_type: filters.inspection_type !== 'all' ? filters.inspection_type : undefined,
                market_id: filters.market_id || undefined,
                product_name: filters.product_name !== 'all' ? filters.product_name : undefined,
                origin: filters.origin !== 'all' ? filters.origin : undefined,
                thickness: filters.thickness !== 'all' ? filters.thickness : undefined,
                process: filters.process !== 'all' ? filters.process : undefined,
                area: filters.area !== 'all' ? filters.area : undefined,
                machine: filters.machine !== 'all' ? filters.machine : undefined
            };
            const response = await api.get('/api/reports/global-stats', { params });
            const serverData = response.data;
            const totalPieces = (serverData.grade_breakdown || []).reduce((acc, curr) => acc + curr.value, 0);

            // Process grade summary from mapped backend response
            const gradeSummary = (serverData.grade_breakdown || []).map(g => ({
                name: g.name,
                count: g.value,
                percentage: totalPieces ? (g.value / totalPieces) * 100 : 0
            }));

            // Process defects breakdown
            const defectSummary = (serverData.defects_breakdown || []).map(d => ({
                name: d.name,
                count: d.value,
                percentage: totalPieces ? (d.value / totalPieces) * 100 : 0
            })).sort((a, b) => b.count - a.count);

            setStats({
                ...serverData,
                gradeSummary,
                defectSummary,
                totalPieces,
                defectsByGrade: serverData.defects_by_grade || {},
                trend_data: serverData.trend_data || [],
                grades_by_product: serverData.grades_by_product || [],
                grades_by_product_month: serverData.grades_by_product_month || [],
                trend_12m: serverData.trend_12m || []
            });
        } catch (err) {
            console.error("Error fetching stats", err);
            setError("Error al cargar los datos del reporte.");
        } finally {
            setLoading(false);
        }
    };

    // Initial Fetch on mount
    useEffect(() => {
        fetchStats();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchStats();
    };

    const handleDownloadSummary = () => {
        const params = {
            start_date: filters.start_date || undefined,
            end_date: filters.end_date || undefined,
            inspection_type: filters.inspection_type !== 'all' ? filters.inspection_type : undefined,
            market_id: filters.market_id || undefined,
            product_name: filters.product_name !== 'all' ? filters.product_name : undefined,
            origin: filters.origin !== 'all' ? filters.origin : undefined,
            thickness: filters.thickness !== 'all' ? filters.thickness : undefined,
            process: filters.process !== 'all' ? filters.process : undefined,
            area: filters.area !== 'all' ? filters.area : undefined,
            machine: filters.machine !== 'all' ? filters.machine : undefined
        };
        downloadInspectionsCsv(params);
    };

    const handleDownloadDetails = () => {
        const params = {
            start_date: filters.start_date || undefined,
            end_date: filters.end_date || undefined,
            inspection_type: filters.inspection_type !== 'all' ? filters.inspection_type : undefined,
            market_id: filters.market_id || undefined,
            product_name: filters.product_name !== 'all' ? filters.product_name : undefined,
            origin: filters.origin !== 'all' ? filters.origin : undefined,
            thickness: filters.thickness !== 'all' ? filters.thickness : undefined,
            process: filters.process !== 'all' ? filters.process : undefined,
            area: filters.area !== 'all' ? filters.area : undefined,
            machine: filters.machine !== 'all' ? filters.machine : undefined
        };
        downloadInspectionDetailsCsv(params);
    };

    // Sort and process product-month data for the vertical stacked chart
    const processedProductMonthData = React.useMemo(() => {
        if (!stats || !Array.isArray(stats.grades_by_product_month)) return [];
        return [...stats.grades_by_product_month].sort((a, b) => {
            const prodCompare = a.product.localeCompare(b.product);
            if (prodCompare !== 0) return prodCompare;
            return a.month_key.localeCompare(b.month_key);
        });
    }, [stats]);

    // Dynamic list of active grades present in current stats, sorted by quality rank
    const activeGrades = React.useMemo(() => {
        if (!stats || !Array.isArray(stats.gradeSummary)) return [];
        return stats.gradeSummary.map((g) => g.name).filter(Boolean);
    }, [stats]);

    const executiveSummary = null;

    // Filter active grades for cogeneration section (non-top quality, non-rejection, having defects)
    const cogenGrades = React.useMemo(() => {
        if (!stats || !Array.isArray(activeGrades)) return [];
        return activeGrades.filter((grade, idx) => {
            if (idx === 0) return false; // Exclude top quality grade
            const nameUpper = grade.toUpperCase();
            const isRejection = nameUpper.includes('RECH') || nameUpper.includes('REJ');
            if (isRejection) return false; // Exclude rejection grades
            
            // Check if it has defects data (not empty)
            const gradeData = stats?.defectsByGrade?.[grade] || { defects: {} };
            const hasDefects = Object.keys(gradeData.defects || {}).length > 0;
            return hasDefects;
        });
    }, [stats, activeGrades]);

    // Filter active grades for rejection section (rejection grades, having defects)
    const rejectionGrades = React.useMemo(() => {
        if (!stats || !Array.isArray(activeGrades)) return [];
        return activeGrades.filter((grade) => {
            const nameUpper = grade.toUpperCase();
            const isRejection = nameUpper.includes('RECH') || nameUpper.includes('REJ');
            if (!isRejection) return false; // Must be rejection grade
            
            // Check if it has defects data (not empty)
            const gradeData = stats?.defectsByGrade?.[grade] || { defects: {} };
            const hasDefects = Object.keys(gradeData.defects || {}).length > 0;
            return hasDefects;
        });
    }, [stats, activeGrades]);

    // Render horizontal bar chart card for defects breakdown of a specific grade
    const renderGradeDefectCard = (grade) => {
        const gradeData = stats?.defectsByGrade?.[grade] || { total: 0, defects: {} };
        const chartData = Object.entries(gradeData.defects || {})
            .map(([name, count]) => {
                const pct = stats.totalPieces > 0 ? ((count / stats.totalPieces) * 100).toFixed(1) : '0';
                return {
                    name,
                    count,
                    percentage: parseFloat(pct)
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // top 5 defects
        
        const hasData = chartData.length > 0;
        const gradeIdx = activeGrades.indexOf(grade);
        const gradeColor = getGradeColor(grade, gradeIdx);

        return (
            <div key={grade} className="ga-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', borderTop: `4px solid ${gradeColor}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', margin: 0 }}>
                        {grade.toUpperCase().includes('RECH') || grade.toUpperCase().includes('REJ') ? 'Razones de Rechazo:' : 'Motivos Degradación:'} {grade}
                    </h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>
                        Total: {(gradeData.total || 0).toLocaleString()} pzas.
                    </span>
                </div>
                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '260px' }}>
                    {!hasData ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', padding: '2rem' }}>
                            Sin defectos registrados para este grado.
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: '220px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        type="number"
                                        tickFormatter={(val) => `${val}%`}
                                        tick={{ fontSize: 9, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category"
                                        tick={{ fontSize: 10, fontWeight: 'bold', fill: '#334155' }}
                                        width={90}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '6px',
                                            border: 'none',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                            fontSize: '0.7rem'
                                        }}
                                        formatter={(value, name, props) => {
                                            const count = props.payload.count || 0;
                                            return [`${count.toLocaleString()} pzas (${value}%)`, 'Proporción'];
                                        }}
                                    />
                                    <Bar 
                                        dataKey="percentage" 
                                        fill={gradeColor} 
                                        radius={[0, 4, 4, 0]}
                                        isAnimationActive={false}
                                    >
                                        <LabelList 
                                            dataKey="percentage" 
                                            position="right" 
                                            formatter={(val) => `${val}%`}
                                            style={{ fontSize: '0.75rem', fill: '#475569', fontWeight: 'bold' }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="ga-page-content u-p-4">
            {/* Header */}
            <header className="u-mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="u-text-2xl u-bold u-mb-2" style={{ color: 'var(--ga-primary)' }}>Reporte de Inspecciones Grading</h1>
                    <p className="u-text-gray-500">Resumen del universo total de inspecciones.</p>
                </div>
                <div className="u-flex u-gap-2">
                    <button 
                        type="button"
                        onClick={handleDownloadSummary} 
                        className="ga-btn ga-btn--outline u-text-xs u-py-2 u-flex u-items-center u-gap-1"
                        style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
                    >
                        <Download size={14} /> Descargar Resumen (CSV)
                    </button>
                    <button 
                        type="button"
                        onClick={handleDownloadDetails} 
                        className="ga-btn ga-btn--accent u-text-xs u-py-2 u-flex u-items-center u-gap-1"
                        style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
                    >
                        <Download size={14} /> Descargar Detalle (CSV)
                    </button>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="ga-card u-mb-4" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #dbe3ee', color: '#1e3a5f' }}>
                    <Filter size={16} color="#00968F" />
                    <h2 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>Filtros de búsqueda</h2>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem 1.25rem', padding: '1.25rem 1.25rem 1.1rem', alignItems: 'end' }}>
                    {/* Date Range */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Desde</label>
                        <input
                            type="date"
                            name="start_date"
                            value={filters.start_date}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        />
                    </div>
                    <div className="u-flex u-flex-col u-gap-1">
                        <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Hasta</label>
                        <input
                            type="date"
                            name="end_date"
                            value={filters.end_date}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        />
                    </div>

                    {/* Type */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Package size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Tipo</label>
                        </div>
                        <select
                            name="inspection_type"
                            value={filters.inspection_type}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            <option value="finished_product">Prod. Terminado</option>
                            <option value="line_grading">Mesa Clasificación</option>
                            <option value="rejection_typing">Tip. Rechazo</option>
                        </select>
                    </div>

                    {/* Market */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Globe size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Mercado</label>
                        </div>
                        <select
                            name="market_id"
                            value={filters.market_id}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="">Todos</option>
                            {markets.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Filter size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Producto</label>
                        </div>
                        <select
                            name="product_name"
                            value={filters.product_name}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            {products.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Origin */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <FileText size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Origen</label>
                        </div>
                        <select
                            name="origin"
                            value={filters.origin}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            {origins.map(o => (
                                <option key={o.id} value={o.name}>{o.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Thickness */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Filter size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Espesor</label>
                        </div>
                        <select
                            name="thickness"
                            value={filters.thickness}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            {thicknesses.map((t, idx) => (
                                <option key={idx} value={t}>{t} mm</option>
                            ))}
                        </select>
                    </div>

                    {/* Process */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Settings size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Proceso</label>
                        </div>
                        <select
                            name="process"
                            value={filters.process}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            <option value="Verde">Verde</option>
                            <option value="Seco">Seco</option>
                            <option value="General">General</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>

                    {/* Area */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Filter size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Área</label>
                        </div>
                        <select
                            name="area"
                            value={filters.area}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            {areas.map(a => (
                                <option key={a.id} value={a.name}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Machine */}
                    <div className="u-flex u-flex-col u-gap-1">
                        <div className="u-flex u-items-center u-gap-1">
                            <Settings size={14} className="u-text-gray-400" />
                            <label className="u-text-2xs u-bold u-uppercase u-text-gray-500">Máquina</label>
                        </div>
                        <select
                            name="machine"
                            value={filters.machine}
                            onChange={handleFilterChange}
                            className="ga-input u-w-full u-text-xs u-py-1"
                        >
                            <option value="all">Todos</option>
                            {machines.map(m => (
                                <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Submit & Reset Buttons */}
                    <div className="u-flex u-gap-2">
                        <button type="submit" className="ga-btn ga-btn--primary u-text-xs u-py-2" style={{ minWidth: '118px' }}>
                            <Filter size={14} />
                            Generar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFilters({
                                    start_date: '',
                                    end_date: '',
                                    inspection_type: 'all',
                                    market_id: '',
                                    product_name: 'all',
                                    origin: 'all',
                                    thickness: 'all',
                                    process: 'all',
                                    area: 'all',
                                    machine: 'all'
                                });
                            }}
                            className="ga-btn ga-btn--outline u-text-2xs u-py-2"
                        >
                            Limpiar
                        </button>
                    </div>
                </form>
            </div>

            {loading && <div className="u-text-center u-p-8 u-text-gray-500">Cargando reporte...</div>}
            {error && <div className="ga-card u-bg-red-50 u-text-red-600 u-p-4 u-text-center">{error}</div>}

            {stats && !loading && (
                <div className="ga-card" style={{ background: 'white', padding: 0, overflow: 'hidden' }}>
                    {/* Header Summary */}
                    <div style={{ display: 'none', background: 'var(--ga-primary)', padding: '1.5rem', color: 'white' }}>
                        <div className="u-text-white" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Total Inspecciones</div>
                                <div className="u-text-2xl u-bold">{stats.total_inspections}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Piezas Evaluadas</div>
                                <div className="u-text-2xl u-bold">{stats.totalPieces.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Mercados</div>
                                <div className="u-text-xl">{filters.market_id ? 'Filtrado' : 'Todos'}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Productos</div>
                                <div className="u-text-xl">{filters.product_name !== 'all' ? filters.product_name : 'Todos'}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Origen</div>
                                <div className="u-text-xl">{filters.origin !== 'all' ? filters.origin : 'Todos'}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Área</div>
                                <div className="u-text-xl">{filters.area !== 'all' ? filters.area : 'Todas'}</div>
                            </div>
                            <div>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Máquina</div>
                                <div className="u-text-xl">{filters.machine !== 'all' ? filters.machine : 'Todas'}</div>
                            </div>
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>
                                <div className="u-text-2xs u-bold u-uppercase u-opacity-70">Periodo</div>
                                <div className="u-text-sm u-bold">
                                    {filters.start_date ? formatSpanishDate(filters.start_date) : 'Inicio'} - {filters.end_date ? formatSpanishDate(filters.end_date) : 'Hoy'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    {executiveSummary && (
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #fff, #fbfdff)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', margin: 0 }}>Resumen Ejecutivo</h3>
                                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Lectura rápida del comportamiento de calidad en el período filtrado.</p>
                                </div>
                                <span className={`ga-badge ${executiveSummary.trendLabel === 'Mejorando' ? 'ga-badge--ok' : executiveSummary.trendLabel === 'Empeorando' ? 'ga-badge--warn' : 'ga-badge--muted'}`}>
                                    Tendencia: {executiveSummary.trendLabel}
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#fff' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Tasa de rechazo</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ef4444' }}>{executiveSummary.rejectionRate.toFixed(2)}%</div>
                                </div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#fff' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Grado dominante</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#334155' }}>{executiveSummary.topGrade?.name || 'N/D'}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{executiveSummary.topGrade ? `${executiveSummary.topGrade.count.toLocaleString()} piezas` : 'Sin datos'}</div>
                                </div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#fff' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Defecto principal</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#334155' }}>{executiveSummary.topDefect?.name || 'N/D'}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{executiveSummary.topDefect ? `${executiveSummary.topDefect.count.toLocaleString()} piezas` : 'Sin datos'}</div>
                                </div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#fff' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Producto líder</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#334155' }}>{executiveSummary.topProduct?.name || 'N/D'}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{executiveSummary.topProduct ? `${executiveSummary.topProduct.value.toLocaleString()} inspecciones` : 'Sin datos'}</div>
                                </div>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1rem', background: '#fff' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800 }}>Piezas con defecto</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#334155' }}>{executiveSummary.totalDefects.toLocaleString()}</div>
                                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Sobre {stats.totalPieces.toLocaleString()} piezas</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Layout Sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem' }}>
                        
                        {/* SECTION 1: HIERARCHICAL STACKED COLUMN CHART (PRODUCT -> MONTH) */}
                        <div className="ga-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <div style={{ background: '#e2e8f0', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', margin: 0 }}>
                                    Distribución de Grados
                                </h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1.5rem', padding: '1.5rem', alignItems: 'start' }}>
                                {processedProductMonthData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        No hay datos suficientes para graficar la distribución.
                                    </div>
                                ) : (
                                    <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '1rem' }}>
                                        <BarChart 
                                            width={920}
                                            height={350}
                                            data={processedProductMonthData} 
                                            stackOffset="expand"
                                            margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis 
                                                dataKey="label" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                height={60}
                                                interval={0}
                                                tick={(props) => <CustomXAxisTick {...props} data={processedProductMonthData} />}
                                            />
                                            <YAxis 
                                                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                                                tick={{ fontSize: 11, fill: '#64748b' }} 
                                                axisLine={false} 
                                                tickLine={false}
                                                domain={[0, 1]}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    borderRadius: '8px', 
                                                    border: 'none', 
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                    fontSize: '0.75rem' 
                                                }}
                                                formatter={(value, name, props) => {
                                                    const rawVal = props.payload[props.dataKey] || 0;
                                                    const total = props.payload.total || 0;
                                                    const pct = total > 0 ? ((rawVal / total) * 100).toFixed(1) : '0';
                                                    return [`${rawVal.toLocaleString()} piezas (${pct}%)`, name];
                                                }}
                                                labelFormatter={(label) => {
                                                    const parts = label.split('|');
                                                    return `Producto: ${parts[0]} - Mes: ${parts[1]}`;
                                                }}
                                            />
                                            <Legend 
                                                verticalAlign="top" 
                                                height={40}
                                                wrapperStyle={{ fontSize: '0.75rem', fontWeight: 'bold' }}
                                            />
                                            {activeGrades.map((grade, idx) => (
                                                <Bar key={grade} dataKey={grade} name={grade} stackId="quality" fill={getGradeColor(grade, idx)} isAnimationActive={false}>
                                                    <LabelList dataKey={grade} content={(props) => renderCustomLabel(props, grade)} />
                                                </Bar>
                                            ))}
                                        </BarChart>
                                    </div>
                                )}
                                <div style={{ border: '1px solid #dbe3ee', borderRadius: '8px', background: '#f8fafc', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #dbe3ee', color: '#1e3a5f', fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                        Resumen de grados
                                    </div>
                                    <div style={{ maxHeight: '285px', overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 45px', gap: '0.5rem', padding: '0.55rem 0.25rem', borderBottom: '1px solid #dbe3ee', color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>
                                            <span>Grado</span>
                                            <span style={{ textAlign: 'right' }}>Piezas</span>
                                            <span style={{ textAlign: 'right' }}>%</span>
                                        </div>
                                        {stats.gradeSummary.map((grade, idx) => (
                                            <div key={grade.name} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 45px', gap: '0.5rem', alignItems: 'center', padding: '0.62rem 0.25rem', borderBottom: '1px solid #e8edf3', fontSize: '0.78rem', color: '#1e3a5f' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                                                    <span style={{ width: '12px', height: '12px', flex: '0 0 12px', borderRadius: '50%', background: getGradeColor(grade.name, idx) }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grade.name}</span>
                                                </span>
                                                <strong style={{ textAlign: 'right' }}>{grade.count.toLocaleString()}</strong>
                                                <span style={{ textAlign: 'right', color: '#475569' }}>{grade.percentage.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 1rem', borderTop: '1px solid #cbd5e1', color: '#1e3a5f', fontSize: '0.8rem', fontWeight: 800 }}>
                                        <span>Total Piezas</span>
                                        <span>{stats.totalPieces.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: DEGRADATION & REJECTION REASONS BY SUB-PRODUCT GRADE */}
                        {cogenGrades.length > 0 && (
                            <div className="u-mb-6">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '1.25rem', borderBottom: '2px solid #00968F', paddingBottom: '0.25rem', display: 'inline-block' }}>
                                    Razones de Cogeneración
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {cogenGrades.map((grade) => renderGradeDefectCard(grade))}
                                </div>
                            </div>
                        )}

                        {rejectionGrades.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', marginBottom: '1.25rem', borderBottom: '2px solid #5F5953', paddingBottom: '0.25rem', display: 'inline-block' }}>
                                    Razones de Rechazo
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                    {rejectionGrades.map((grade) => renderGradeDefectCard(grade))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalReport;
