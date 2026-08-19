import React, { useState, useEffect } from 'react';
import api, { downloadInspectionsCsv, downloadInspectionDetailsCsv } from '../api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, ComposedChart, Line, LabelList
} from 'recharts';
import { Filter, Calendar, FileText, Globe, Package, Download, Settings, BarChart2, TrendingUp } from 'lucide-react';
import { formatSpanishDate } from '../utils/dataUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// Helper to get grade color matching the user's PowerBI screenshot
const getGradeColor = (gradeName) => {
    const name = gradeName.toUpperCase();
    if (name === 'COL') return '#0B5C8C';       // Dark blue
    if (name === 'COB') return '#E67E22';       // Orange
    if (name === 'COP') return '#27AE60';       // Green
    if (name === 'RECHAZO') return '#00A3E0';   // Cyan
    if (name.includes('RECH')) return '#00A3E0';
    return '#8884d8';
};

// Custom component to render hierarchical X-axis ticks (Product name on top line, Month below)
const CustomXAxisTick = (props) => {
    const { x, y, payload } = props;
    if (!payload || !payload.value) return null;
    const parts = payload.value.split('|');
    const product = parts[0] || '';
    const month = parts[1] || '';
    
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={15} textAnchor="middle" fill="#334155" fontSize={11} fontWeight="800">
                {product}
            </text>
            <text x={0} y={30} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="500">
                {month}
            </text>
        </g>
    );
};

// Custom component to render segment text labels inside stacked bars
const renderCustomLabel = (props, gradeName) => {
    const { x, y, width, height, value } = props;
    // Hide label if the segment is too thin to prevent text overlap
    if (height < 20 || !value) return null;
    
    return (
        <text
            x={x + width / 2}
            y={y + height / 2}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight="900"
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

    // Data State
    const [markets, setMarkets] = useState([]);
    const [products, setProducts] = useState([]);
    const [origins, setOrigins] = useState([]);
    const [thicknesses, setThicknesses] = useState([]);
    const [areas, setAreas] = useState([]);
    const [machines, setMachines] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // View Toggles
    const [trendType, setTrendType] = useState('mensual'); // 'diaria', 'semanal', 'mensual', 'global'
    const [viewMode, setViewMode] = useState('stacked'); // 'stacked', 'trend'

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
                // Ensure array
                setMarkets(Array.isArray(marketsRes.data) ? marketsRes.data : []);
                setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);

                // Robust Origin List (Catalog + Existing Data)
                const catalogOrigins = Array.isArray(catalogOriginsRes.data) ? catalogOriginsRes.data.map(o => o.name) : [];
                const distinctOrigins = Array.isArray(distinctOriginsRes.data) ? distinctOriginsRes.data : [];
                const combinedOrigins = [...new Set([...catalogOrigins, ...distinctOrigins])];
                setOrigins(combinedOrigins.map((name, idx) => ({ id: idx, name })));

                // Distinct Thicknesses
                const distinctThicknesses = Array.isArray(distinctThicknessRes.data) ? distinctThicknessRes.data : [];
                const sortedThicknesses = distinctThicknesses
                    .filter(t => t && t !== '-1')
                    .sort((a, b) => parseFloat(a) - parseFloat(b));
                setThicknesses(sortedThicknesses);

                // Robust Area List (Catalog + Existing Data)
                const catalogAreas = Array.isArray(catalogAreasRes.data) ? catalogAreasRes.data.map(a => a.name) : [];
                const distinctAreas = Array.isArray(distinctAreasRes.data) ? distinctAreasRes.data : [];
                const combinedAreas = [...new Set([...catalogAreas, ...distinctAreas])].filter(Boolean);
                setAreas(combinedAreas.map((name, idx) => ({ id: idx, name })));

                // Robust Machine List (Catalog + Existing Data)
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
            const totalPieces = serverData.grade_breakdown.reduce((acc, curr) => acc + curr.value, 0);

            // Calculate percentages for grades
            const gradeSummary = serverData.grade_breakdown.map(g => ({
                name: g.name,
                count: g.value,
                percentage: totalPieces ? (g.value / totalPieces) * 100 : 0
            })).sort((a, b) => b.count - a.count);

            // Calculate percentages for defects
            const defectSummary = serverData.defects_breakdown.map(d => ({
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

    // Initial Fetch
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

    // Extract distinct grade names from trend data dynamically
    const gradeNames = React.useMemo(() => {
        if (!stats || !stats.trend_data) return [];
        const grades = new Set();
        stats.trend_data.forEach(item => {
            Object.keys(item.grades || {}).forEach(gName => {
                grades.add(gName);
            });
        });
        return Array.from(grades).sort();
    }, [stats]);

    // Extract distinct grade names from product-month data dynamically
    const productMonthGradeNames = React.useMemo(() => {
        if (!stats || !Array.isArray(stats.grades_by_product_month)) return [];
        const grades = new Set();
        stats.grades_by_product_month.forEach((item) => {
            Object.keys(item || {}).forEach((key) => {
                if (key !== 'product' && key !== 'month_key' && key !== 'month_label' && key !== 'year' && key !== 'label' && key !== 'total') {
                    grades.add(key);
                }
            });
        });
        return Array.from(grades).sort();
    }, [stats]);

    // Sort product month data
    const processedProductMonthData = React.useMemo(() => {
        if (!stats || !Array.isArray(stats.grades_by_product_month)) return [];
        return [...stats.grades_by_product_month].sort((a, b) => {
            const prodCompare = a.product.localeCompare(b.product);
            if (prodCompare !== 0) return prodCompare;
            return a.month_key.localeCompare(b.month_key);
        });
    }, [stats]);

    const rollingTrend12m = React.useMemo(() => {
        if (!stats || !Array.isArray(stats.trend_12m)) return [];
        return stats.trend_12m.map((row) => ({
            ...row,
            month: row.label || row.month_key,
            quality_pct: row.total_pieces > 0 ? parseFloat((100 - row.defect_rate).toFixed(2)) : 0,
        }));
    }, [stats]);

    const executiveSummary = React.useMemo(() => {
        if (!stats) return null;

        const topGrade = (stats.gradeSummary || []).find((item) => item.name !== 'RECHAZO') || (stats.gradeSummary || [])[0] || null;
        const topDefect = (stats.defectSummary || [])[0] || null;
        const topProduct = (stats.by_product || [])[0] || null;
        const totalDefects = (stats.defectSummary || []).reduce((acc, item) => acc + (item.count || 0), 0);
        const rejectionRate = stats.totalPieces > 0 ? (totalDefects / stats.totalPieces) * 100 : 0;

        const trend = rollingTrend12m.filter((row) => row.total_pieces > 0);
        let trendLabel = 'Sin tendencia suficiente';
        if (trend.length >= 6) {
            const recent = trend.slice(-3).reduce((acc, row) => acc + (row.defect_rate || 0), 0) / 3;
            const previous = trend.slice(-6, -3).reduce((acc, row) => acc + (row.defect_rate || 0), 0) / 3;
            const diff = recent - previous;
            if (Math.abs(diff) < 0.2) {
                trendLabel = 'Estable';
            } else if (diff < 0) {
                trendLabel = 'Mejorando';
            } else {
                trendLabel = 'Empeorando';
            }
        }

        return {
            topGrade,
            topDefect,
            topProduct,
            totalDefects,
            rejectionRate,
            trendLabel,
        };
    }, [stats, rollingTrend12m]);

    // Process Trend Data based on trendType (diaria, semanal, mensual, global)
    const processedTrendData = React.useMemo(() => {
        if (!stats || !stats.trend_data || stats.trend_data.length === 0) {
            return [];
        }

        const data = stats.trend_data;

        if (trendType === 'global') {
            return data.map((item, idx) => {
                const total = item.total || 0;
                const rechazo = item.grades['RECHAZO'] || 0;
                const rechazoPct = total > 0 ? (rechazo / total) * 100 : 0;
                
                const gradesData = {};
                Object.keys(item.grades || {}).forEach(grade => {
                    gradesData[grade] = item.grades[grade];
                    gradesData[`${grade}_pct`] = total > 0 ? (item.grades[grade] / total) * 100 : 0;
                });

                return {
                    name: item.lot ? `${item.lot}` : `#${item.id}`,
                    date: item.date,
                    total: total,
                    rechazo: rechazo,
                    rechazoPct: parseFloat(rechazoPct.toFixed(1)),
                    ...gradesData
                };
            });
        }

        const groups = {};
        data.forEach(item => {
            let key = item.date || 'Sin Fecha';
            if (trendType === 'mensual' && item.date) {
                key = item.date.substring(0, 7); // YYYY-MM
            } else if (trendType === 'semanal' && item.date) {
                const d = new Date(item.date + 'T12:00:00');
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(d.setDate(diff));
                key = monday.toISOString().split('T')[0];
            }

            if (!groups[key]) {
                groups[key] = {
                    key: key,
                    total: 0,
                    grades: {}
                };
            }

            groups[key].total += item.total || 0;
            Object.keys(item.grades || {}).forEach(grade => {
                if (!groups[key].grades[grade]) {
                    groups[key].grades[grade] = 0;
                }
                groups[key].grades[grade] += item.grades[grade] || 0;
            });
        });

        return Object.values(groups)
            .sort((a, b) => a.key.localeCompare(b.key))
            .map(group => {
                const total = group.total;
                const rechazo = group.grades['RECHAZO'] || 0;
                const rechazoPct = total > 0 ? (rechazo / total) * 100 : 0;

                const gradesData = {};
                Object.keys(group.grades || {}).forEach(grade => {
                    gradesData[grade] = group.grades[grade];
                    gradesData[`${grade}_pct`] = total > 0 ? (group.grades[grade] / total) * 100 : 0;
                });

                let nameLabel = group.key;
                if (trendType === 'mensual') {
                    const parts = group.key.split('-');
                    if (parts.length === 2) {
                        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                        const monthIdx = parseInt(parts[1], 10) - 1;
                        if (monthIdx >= 0 && monthIdx < 12) {
                            nameLabel = `${months[monthIdx]} ${parts[0]}`;
                        }
                    }
                } else if (trendType === 'semanal') {
                    const parts = group.key.split('-');
                    if (parts.length === 3) {
                        nameLabel = `Sem ${parts[2]}/${parts[1]}`;
                    }
                } else if (trendType === 'diaria') {
                    const parts = group.key.split('-');
                    if (parts.length === 3) {
                        nameLabel = `${parts[2]}/${parts[1]}`;
                    }
                }

                return {
                    name: nameLabel,
                    key: group.key,
                    total: total,
                    rechazo: rechazo,
                    rechazoPct: parseFloat(rechazoPct.toFixed(1)),
                    ...gradesData
                };
            });
    }, [stats, trendType]);

    return (
        <div className="ga-page-content u-p-4">
            <header className="u-mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="u-text-2xl u-bold u-mb-2" style={{ color: 'var(--ga-primary)' }}>Reporte Global</h1>
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
            <div className="ga-card u-mb-4 u-p-3">
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', alignItems: 'end' }}>

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

                    {/* Thickness (Espesor) */}
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

                    {/* Process (Proceso) */}
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

                    {/* Area (Área) */}
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

                    {/* Machine (Máquina) */}
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

                    {/* Submit & Reset */}
                    <div className="u-flex u-gap-2">
                        <button type="submit" className="ga-btn ga-btn--primary u-w-full u-text-xs u-py-2">
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
                    <div style={{ background: 'var(--ga-primary)', padding: '1.5rem', color: 'white' }}>
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

                    {/* Visual Content: Stacked Vertical Layout */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* SECTION 0: ROLLING 12M TREND */}
                        <div className="ga-card" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ background: '#dbe4f0', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', margin: 0 }}>Tendencia móvil 12M</h3>
                                <span className="u-text-xs u-bold u-uppercase u-text-gray-500">Calidad y rechazo por mes</span>
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                {rollingTrend12m.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        No hay datos suficientes para construir la tendencia móvil.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '0.8rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px 70px', gap: '0.5rem', alignItems: 'center', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8' }}>
                                            <span>Mes</span>
                                            <span>Calidad</span>
                                            <span>% Rech.</span>
                                            <span>Pzas.</span>
                                            <span>Def.</span>
                                        </div>
                                        {rollingTrend12m.map((row) => {
                                            const width = Math.max(4, Math.min(100, row.quality_pct || 0));
                                            const isEmpty = (row.total_pieces || 0) === 0;
                                            return (
                                                <div key={row.month_key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px 70px', gap: '0.5rem', alignItems: 'center' }}>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>{row.month}</div>
                                                    <div style={{ height: '18px', background: '#eef2f7', borderRadius: '999px', overflow: 'hidden', border: '1px solid #dbe3ee' }}>
                                                        <div style={{ width: `${width}%`, height: '100%', background: isEmpty ? '#cbd5e1' : 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: row.defect_rate > 15 ? '#dc2626' : '#334155' }}>{row.defect_rate.toFixed(1)}%</div>
                                                    <div style={{ fontSize: '0.82rem', color: '#334155', textAlign: 'right' }}>{row.total_pieces.toLocaleString()}</div>
                                                    <div style={{ fontSize: '0.82rem', color: '#334155', textAlign: 'right' }}>{row.defect_pieces.toLocaleString()}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECTION 1: GRADE DISTRIBUTION */}
                        <div className="ga-card" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ background: '#e2e8f0', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' }}>Distribución de Grado Global</h3>
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Distribución mensual de calidad</h4>
                                    {rollingTrend12m.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                                            {rollingTrend12m.map((item, idx) => {
                                                const maxPieces = Math.max(1, ...rollingTrend12m.map((r) => r.total_pieces || 0));
                                                const quality = item.quality_pct || 0;
                                                const reject = item.defect_rate || 0;
                                                return (
                                                    <div key={`${item.month_key}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 70px', gap: '0.75rem', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>{item.month}</div>
                                                        <div style={{ display: 'flex', height: '18px', borderRadius: '999px', overflow: 'hidden', background: '#eef2f7', border: '1px solid #dbe3ee' }}>
                                                            <div title={`Calidad: ${quality.toFixed(1)}%`} style={{ width: `${quality}%`, minWidth: item.total_pieces > 0 ? '4px' : 0, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
                                                            <div title={`Rechazo: ${reject.toFixed(1)}%`} style={{ width: `${reject}%`, minWidth: item.total_pieces > 0 ? '4px' : 0, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', textAlign: 'right', color: '#64748b' }}>
                                                            {item.defect_rate.toFixed(1)}%
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', textAlign: 'right', color: '#64748b' }}>
                                                            {item.total_pieces.toLocaleString()}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No hay datos suficientes para graficar la distribución mensual.
                                        </div>
                                    )}
                                </div>

                                {/* Grade Table */}
                                <div style={{ border: '1px solid var(--ga-border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>Grado</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>Piezas</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.gradeSummary.map((grade, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{grade.name}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{grade.count.toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{grade.percentage.toFixed(2)}%</td>
                                                </tr>
                                            ))}

                                            <tr style={{ background: '#1e293b', color: 'white', fontWeight: 'bold' }}>
                                                <td style={{ padding: '0.75rem' }}>TOTAL</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{stats.totalPieces.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>100%</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: TREND AND DISTRIBUTION ANALYSIS */}
                        <div className="ga-card" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ background: '#e2e8f0', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', margin: 0 }}>Análisis de Tendencia y Distribución</h3>
                                
                                {/* View Mode Selector */}
                                <div style={{ display: 'flex', gap: '0.25rem', background: '#cbd5e1', padding: '0.2rem', borderRadius: '6px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('stacked')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            background: viewMode === 'stacked' ? 'white' : 'transparent',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            color: viewMode === 'stacked' ? 'var(--ga-primary)' : '#475569',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: viewMode === 'stacked' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        <BarChart2 size={14} /> Distribución Apilada (Producto/Mes)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('trend')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            background: viewMode === 'trend' ? 'white' : 'transparent',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '0.25rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            color: viewMode === 'trend' ? 'var(--ga-primary)' : '#475569',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: viewMode === 'trend' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        <TrendingUp size={14} /> Línea de Tendencia
                                    </button>
                                </div>

                                {/* Trend Selector (only shown in trend line view) */}
                                {viewMode === 'trend' && (
                                    <div style={{ display: 'flex', gap: '0.25rem', background: '#cbd5e1', padding: '0.2rem', borderRadius: '6px' }}>
                                        {[
                                            { id: 'diaria', label: 'Diaria' },
                                            { id: 'semanal', label: 'Semanal' },
                                            { id: 'mensual', label: 'Mensual' },
                                            { id: 'global', label: 'Global (Lote)' }
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setTrendType(type.id)}
                                                style={{
                                                    background: trendType === type.id ? 'white' : 'transparent',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '0.25rem 0.75rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: trendType === type.id ? 'bold' : 'normal',
                                                    color: trendType === type.id ? 'var(--ga-primary)' : '#475569',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: trendType === type.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                                }}
                                            >
                                                {type.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '1.5rem' }}>
                                {viewMode === 'stacked' ? (
                                    processedProductMonthData.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No hay datos suficientes para graficar la distribución.
                                        </div>
                                    ) : (
                                        <div style={{ minHeight: '380px', width: '100%' }}>
                                            <ResponsiveContainer width="100%" height={380}>
                                                <BarChart 
                                                    data={processedProductMonthData} 
                                                    stackOffset="expand"
                                                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis 
                                                        dataKey="label" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        height={50}
                                                        tick={<CustomXAxisTick />}
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
                                                            const total = props.payload.total || 0;
                                                            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                                            return [`${value.toLocaleString()} piezas (${pct}%)`, name];
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
                                                    
                                                    {productMonthGradeNames.map((grade) => {
                                                        const barColor = getGradeColor(grade);
                                                        return (
                                                            <Bar 
                                                                key={grade} 
                                                                dataKey={grade} 
                                                                name={grade} 
                                                                stackId="a" 
                                                                fill={barColor}
                                                            >
                                                                <LabelList 
                                                                    dataKey={grade} 
                                                                    content={(props) => renderCustomLabel(props, grade)} 
                                                                />
                                                            </Bar>
                                                        );
                                                    })}
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )
                                ) : (
                                    processedTrendData.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No hay datos suficientes para graficar la tendencia.
                                        </div>
                                    ) : (
                                        <div style={{ minHeight: '350px', width: '100%' }}>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <ComposedChart data={processedTrendData}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        tick={{ fontSize: 11, fill: '#64748b' }} 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                    />
                                                    <YAxis 
                                                        yAxisId="left"
                                                        tick={{ fontSize: 11, fill: '#64748b' }} 
                                                        axisLine={false} 
                                                        tickLine={false}
                                                        label={{ value: 'Distribución de Grados (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11, fontWeight: 'bold' } }}
                                                    />
                                                    <YAxis 
                                                        yAxisId="right"
                                                        orientation="right"
                                                        tick={{ fontSize: 11, fill: '#64748b' }} 
                                                        axisLine={false} 
                                                        tickLine={false}
                                                        label={{ value: 'Volumen (Piezas)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#64748b', fontSize: 11, fontWeight: 'bold' } }}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ 
                                                            borderRadius: '8px', 
                                                            border: 'none', 
                                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                            fontSize: '0.75rem' 
                                                        }}
                                                        formatter={(value, name) => {
                                                            if (name === 'total') return [value.toLocaleString(), 'Volumen Total'];
                                                            if (name.startsWith('% ')) {
                                                                return [`${value}%`, name];
                                                            }
                                                            return [value.toLocaleString(), name];
                                                        }}
                                                    />
                                                    <Legend 
                                                        verticalAlign="top" 
                                                        height={36}
                                                        wrapperStyle={{ fontSize: '0.75rem' }}
                                                    />
                                                    
                                                    <Bar 
                                                        yAxisId="right" 
                                                        dataKey="total" 
                                                        name="Volumen Inspeccionado" 
                                                        fill="#cbd5e1" 
                                                        radius={[4, 4, 0, 0]}
                                                        barSize={trendType === 'global' ? 12 : 30}
                                                    />
                                                    
                                                    {gradeNames.map((grade, idx) => {
                                                        const isRechazo = grade.toUpperCase() === 'RECHAZO';
                                                        const strokeColor = isRechazo ? '#ef4444' : COLORS[idx % COLORS.length];
                                                        return (
                                                            <Line
                                                                key={grade}
                                                                yAxisId="left"
                                                                type="monotone"
                                                                dataKey={`${grade}_pct`}
                                                                name={`% ${grade}`}
                                                                stroke={strokeColor}
                                                                strokeWidth={isRechazo ? 3 : 2}
                                                                dot={{ r: isRechazo ? 4 : 3, fill: strokeColor, strokeWidth: 0 }}
                                                                activeDot={{ r: 6 }}
                                                            />
                                                        );
                                                    })}
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* SECTION 3: DEGRADATION BY GRADE (TIPES BY GRADE) */}
                        <div className="ga-card" style={{ padding: '0', overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div style={{ background: 'var(--ga-primary)', padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase', margin: 0 }}>
                                    Detalle de Degradación por Grado
                                </h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem' }}>
                                {Object.entries(stats.defectsByGrade || {})
                                    .filter(([gradeName]) => gradeName !== 'EN GRADO')
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([gradeName, gradeData]) => {
                                        const defectsList = Object.entries(gradeData.defects).map(([dName, count]) => ({
                                            name: dName,
                                            count,
                                            percentage: stats.totalPieces ? (count / stats.totalPieces) * 100 : 0
                                        })).sort((a, b) => b.count - a.count);

                                        if (defectsList.length === 0) return null;

                                        return (
                                            <div key={gradeName} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                                <div style={{ background: '#f1f5f9', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#334155', textTransform: 'uppercase', margin: 0 }}>
                                                        {gradeName} <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 'normal', marginLeft: '0.5rem' }}>({gradeData.total.toLocaleString()} piezas)</span>
                                                    </h4>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', padding: '1.25rem' }}>
                                                    {/* Table */}
                                                    <div style={{ border: '1px solid #f1f5f9', borderRadius: '4px' }}>
                                                        <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Defecto</th>
                                                                    <th style={{ padding: '0.5rem', textAlign: 'center', color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>Cant</th>
                                                                    <th style={{ padding: '0.5rem', textAlign: 'center', color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem' }}>% Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {defectsList.map((d, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                        <td style={{ padding: '0.5rem', color: '#334155' }}>{d.name}</td>
                                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{d.count.toLocaleString()}</td>
                                                                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 'bold' }}>{d.percentage.toFixed(1)}%</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Visual Bars */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
                                                        {defectsList.slice(0, 5).map((d, idx) => (
                                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
                                                                    <span>{d.name}</span>
                                                                    <span>{d.percentage.toFixed(1)}%</span>
                                                                </div>
                                                                <div style={{ width: '100%', background: '#f1f5f9', height: '8px', borderRadius: '10px', overflow: 'hidden' }}>
                                                                    <div
                                                                        style={{
                                                                            height: '100%',
                                                                            background: gradeName === 'RECHAZO' ? 'var(--ga-danger)' : 'var(--ga-primary)',
                                                                            width: `${Math.min(100, d.percentage * 5)}%`,
                                                                            borderRadius: '10px'
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {defectsList.length > 5 && <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>Y {defectsList.length - 5} defectos más...</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {Object.keys(stats.defectsByGrade || {}).length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        No hay datos de degradación disponibles para los filtros seleccionados.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalReport;
