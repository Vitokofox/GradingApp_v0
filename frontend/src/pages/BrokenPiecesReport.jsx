import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, AlertTriangle, BarChart3, Camera, FileText, TrendingUp, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatSpanishDate } from '../utils/dataUtils';

const DEFECT_FIELDS = [
    { key: 'broken_mobile', label: 'Quebrada móvil', short: 'Q. móvil', tone: 'danger' },
    { key: 'broken_sawmill', label: 'Quebrada aserradero', short: 'Q. aserradero', tone: 'orange' },
    { key: 'broken_knot', label: 'Quebrada por nudo', short: 'Nudo', tone: 'warning' },
    { key: 'missing_pieces', label: 'Piezas faltantes', short: 'Faltantes', tone: 'gray' },
    { key: 'over_width', label: 'Sobre ancho', short: 'Sobre ancho', tone: 'teal' },
    { key: 'under_width', label: 'Bajo ancho', short: 'Bajo ancho', tone: 'lime' },
    { key: 'warped', label: 'Deformadas', short: 'Deformadas', tone: 'primary' },
    { key: 'in_process', label: 'En proceso', short: 'En proceso', tone: 'muted' },
];

const nf = new Intl.NumberFormat('es-CL');
const nf1 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const nf4 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const asNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const formatM3 = (value, digits = 3) => {
    const n = asNumber(value);
    if (digits === 4) return nf4.format(n);
    if (digits === 2) return nf2.format(n);
    return nf3.format(n);
};

const formatPercent = (ratio) => `${nf1.format(asNumber(ratio) * 100)}%`;

const getLotUnitM3 = (lot = {}) => {
    const piecesTheoretical = asNumber(lot.pieces_theoretical);
    const m3Theoretical = asNumber(lot.m3_theoretical);
    return piecesTheoretical > 0 ? m3Theoretical / piecesTheoretical : 0;
};

const getDefectCount = (lot = {}, key) => asNumber(lot[key]);

const getDefectTotal = (lot = {}) => DEFECT_FIELDS.reduce((acc, field) => acc + getDefectCount(lot, field.key), 0);

const getEstimatedDefectLossM3 = (lot = {}, key) => {
    const count = getDefectCount(lot, key);
    if (count <= 0) return 0;

    const unitM3 = getLotUnitM3(lot);
    if (unitM3 > 0) return count * unitM3;

    // Fallback: if the lot does not have theoretical pieces, distribute the lot loss by defect count.
    const totalDefects = getDefectTotal(lot);
    const lotLossM3 = asNumber(lot.loss_m3);
    return totalDefects > 0 && lotLossM3 > 0 ? lotLossM3 * (count / totalDefects) : 0;
};

const getImageUrls = (imagePath) => {
    if (!imagePath) return [];
    return String(imagePath)
        .split(';')
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => (url.startsWith('http') ? url : `${api.defaults.baseURL}${url}`));
};

const StatCard = ({ label, value, subvalue, tone = 'neutral', icon: Icon }) => (
    <motion.div
        className={`bp-stat-card bp-stat-card--${tone}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
    >
        <div className="bp-stat-head">
            <span>{label}</span>
            {Icon ? <Icon size={18} /> : null}
        </div>
        <div className="bp-stat-value">{value}</div>
        {subvalue ? <div className="bp-stat-subvalue">{subvalue}</div> : null}
    </motion.div>
);

const LossBarChart = ({ lots }) => {
    const topLots = useMemo(() => {
        return [...lots]
            .sort((a, b) => asNumber(b.loss_m3) - asNumber(a.loss_m3))
            .slice(0, 8);
    }, [lots]);

    const maxLoss = Math.max(...topLots.map((lot) => asNumber(lot.loss_m3)), 0.0001);

    if (!topLots.length) {
        return <div className="bp-empty">Sin datos para graficar pérdida por lote.</div>;
    }

    return (
        <div className="bp-chart-list">
            {topLots.map((lot) => {
                const lossM3 = asNumber(lot.loss_m3);
                const width = Math.min(100, (lossM3 / maxLoss) * 100);
                return (
                    <div className="bp-chart-row" key={lot.id || lot.lot_code}>
                        <div className="bp-chart-label" title={lot.lot_code}>{lot.lot_code}</div>
                        <div className="bp-chart-track">
                            <div className="bp-chart-fill" style={{ width: `${width}%` }} />
                        </div>
                        <div className="bp-chart-value">{formatM3(lossM3, 4)} m³</div>
                    </div>
                );
            })}
        </div>
    );
};

const TONE_COLORS = {
    danger: 'var(--bp-danger)',
    orange: 'var(--bp-secondary)',
    warning: '#B35800',
    gray: 'var(--bp-primary)',
    teal: 'var(--bp-info)',
    lime: 'var(--bp-accent)',
    primary: 'var(--bp-primary-dark)',
    muted: 'var(--bp-muted)',
};

const ParetoLossChart = ({ rows }) => {
    const cleanRows = [...rows]
        .filter((row) => row.count > 0 || row.lossM3 > 0)
        .sort((a, b) => b.lossM3 - a.lossM3 || b.count - a.count);

    const totalVolume = cleanRows.reduce((acc, row) => acc + asNumber(row.lossM3), 0);
    const maxVolume = Math.max(...cleanRows.map((row) => row.lossM3), 0.0001);
    let cumulativeVolume = 0;

    if (!cleanRows.length) {
        return <div className="bp-empty">Sin defectos registrados.</div>;
    }

    return (
        <div className="bp-pareto">
            {cleanRows.map((row, index) => {
                cumulativeVolume += asNumber(row.lossM3);
                const volumeShare = totalVolume > 0 ? row.lossM3 / totalVolume : 0;
                const cumulativeShare = totalVolume > 0 ? cumulativeVolume / totalVolume : 0;
                const width = Math.min(100, (row.lossM3 / maxVolume) * 100);
                const isMain = index === 0;

                return (
                    <div className={`bp-pareto-row ${isMain ? 'bp-pareto-row--main' : ''}`} key={row.key}>
                        <div className="bp-pareto-rank">{index + 1}</div>
                        <div className="bp-pareto-name">
                            <span className={`bp-dot bp-dot--${row.tone}`} />
                            <div>
                                <strong>{row.label}</strong>
                                <span>{nf.format(row.count)} eventos · {formatM3(row.lossM3, 4)} m³</span>
                            </div>
                        </div>
                        <div className="bp-pareto-bars">
                            <div className="bp-pareto-track">
                                <div
                                    className={`bp-pareto-fill bp-defect-fill--${row.tone}`}
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                            <div className="bp-pareto-meta">
                                <span>Participación: <strong>{nf1.format(volumeShare * 100)}%</strong></span>
                                <span>Acumulado: <strong>{nf1.format(cumulativeShare * 100)}%</strong></span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const VolumeShareDonut = ({ rows }) => {
    const cleanRows = [...rows]
        .filter((row) => row.lossM3 > 0)
        .sort((a, b) => b.lossM3 - a.lossM3)
        .slice(0, 6);
    const total = cleanRows.reduce((acc, row) => acc + asNumber(row.lossM3), 0);
    let cursor = 0;

    if (!cleanRows.length || total <= 0) {
        return <div className="bp-empty">Sin volumen para participación porcentual.</div>;
    }

    const gradient = cleanRows.map((row) => {
        const start = cursor;
        const end = cursor + (row.lossM3 / total) * 100;
        cursor = end;
        return `${TONE_COLORS[row.tone] || 'var(--bp-primary)'} ${start}% ${end}%`;
    }).join(', ');

    return (
        <div className="bp-donut-layout">
            <div className="bp-donut" style={{ background: `conic-gradient(${gradient})` }}>
                <div className="bp-donut-hole">
                    <strong>{formatM3(total, 4)}</strong>
                    <span>m³</span>
                </div>
            </div>
            <div className="bp-donut-legend">
                {cleanRows.map((row) => (
                    <div className="bp-donut-legend-row" key={row.key}>
                        <span className={`bp-dot bp-dot--${row.tone}`} />
                        <span>{row.short}</span>
                        <strong>{nf1.format((row.lossM3 / total) * 100)}%</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BrokenPiecesReport = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [study, setStudy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchStudy = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await api.get(`/broken-pieces/${id}`);
                if (isMounted) setStudy(res.data);
            } catch (err) {
                console.error('Error fetching broken pieces report', err);
                if (isMounted) setError('No se pudo cargar el reporte de piezas quebradas.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchStudy();
        return () => { isMounted = false; };
    }, [id]);

    const report = useMemo(() => {
        const lots = Array.isArray(study?.lots) ? study.lots : [];
        let maxLossLot = null;
        let maxLossVal = -1;
        let totalDefects = 0;
        let totalDefectLossM3 = 0;
        let mobileLossVol = 0;
        let mobileLossCount = 0;

        const defectMap = DEFECT_FIELDS.reduce((acc, field) => {
            acc[field.key] = {
                ...field,
                count: 0,
                lossM3: 0,
                topLotCode: '',
                topLotLossM3: 0,
            };
            return acc;
        }, {});

        lots.forEach((lot) => {
            const lotLossM3 = asNumber(lot.loss_m3);
            if (lotLossM3 > maxLossVal) {
                maxLossVal = lotLossM3;
                maxLossLot = lot;
            }

            DEFECT_FIELDS.forEach((field) => {
                const count = getDefectCount(lot, field.key);
                const lossM3 = getEstimatedDefectLossM3(lot, field.key);
                defectMap[field.key].count += count;
                defectMap[field.key].lossM3 += lossM3;
                totalDefects += count;
                totalDefectLossM3 += lossM3;

                if (lossM3 > defectMap[field.key].topLotLossM3) {
                    defectMap[field.key].topLotLossM3 = lossM3;
                    defectMap[field.key].topLotCode = lot.lot_code || '';
                }
            });

            mobileLossVol += getEstimatedDefectLossM3(lot, 'broken_mobile');
            mobileLossCount += getDefectCount(lot, 'broken_mobile');
        });

        const defectRows = Object.values(defectMap).sort((a, b) => b.lossM3 - a.lossM3 || b.count - a.count);
        const mainLossAttribute = defectRows.find((row) => row.lossM3 > 0 || row.count > 0) || null;
        const lotsWithImages = lots.filter((lot) => getImageUrls(lot.image_path).length > 0);
        const totalPieces = asNumber(study?.total_pieces);
        const totalLossM3 = asNumber(study?.total_loss_m3);
        const totalM3 = asNumber(study?.total_m3);
        const lossPerThousand = totalPieces > 0 ? (totalDefects / totalPieces) * 1000 : 0;
        const lossM3PerThousandPieces = totalPieces > 0 ? (totalLossM3 / totalPieces) * 1000 : 0;

        return {
            lots,
            lotsWithImages,
            maxLossLot,
            mainLossAttribute,
            mobileLossVol,
            mobileLossCount,
            totalDefects,
            totalDefectLossM3,
            defectRows,
            lossPerThousand,
            lossM3PerThousandPieces,
            totalPieces,
            totalLossM3,
            totalM3,
        };
    }, [study]);

    if (loading) {
        return <div className="bp-loading">Cargando reporte...</div>;
    }

    if (error) {
        return (
            <div className="bp-error">
                <AlertTriangle size={22} />
                <span>{error}</span>
                <button onClick={() => navigate(-1)} className="ga-btn ga-btn--text">Volver</button>
            </div>
        );
    }

    if (!study) {
        return <div className="bp-loading">Estudio no encontrado.</div>;
    }

    const formattedDate = `${formatSpanishDate(study.date)} ${new Date(study.date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;

    return (
        <div className="ga-page bp-report-page">
            <style>{`
                .bp-report-page {
                    --bp-bg: var(--ga-bg, #F4F4F4);
                    --bp-surface: var(--ga-surface, #FFFFFF);
                    --bp-border: var(--ga-border, #D1D5DB);
                    --bp-text: var(--ga-text, #2C2C2C);
                    --bp-muted: var(--ga-muted, #6C757D);
                    --bp-primary: var(--ga-primary, #5F5953);
                    --bp-primary-dark: var(--ga-primary-dark, #4A4540);
                    --bp-accent: var(--ga-accent, #BCC300);
                    --bp-secondary: var(--ga-secondary, #E27000);
                    --bp-info: var(--ga-info, #00968F);
                    --bp-danger: var(--ga-danger, #C0392B);
                    --bp-beige: var(--color-arauco-beige, #E6E2D8);
                    --bp-shadow: var(--ga-shadow-md, 0 4px 6px -1px rgba(0,0,0,0.08));
                    background: var(--bp-bg);
                    color: var(--bp-text);
                    min-height: 100vh;
                    padding-bottom: var(--ga-space-5, 2rem);
                }
                .bp-toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--ga-space-3, 1rem);
                    margin-bottom: var(--ga-space-4, 1.5rem);
                }
                .bp-hero {
                    border: 1px solid var(--bp-border);
                    border-top: 8px solid var(--bp-accent);
                    padding: var(--ga-space-4, 1.5rem);
                    color: var(--color-white, #fff);
                    background:
                        linear-gradient(135deg, rgba(95,89,83,0.96), rgba(74,69,64,0.98)),
                        linear-gradient(90deg, var(--bp-accent), var(--bp-secondary));
                    box-shadow: var(--bp-shadow);
                    margin-bottom: var(--ga-space-4, 1.5rem);
                }
                .bp-hero-top {
                    display: flex;
                    justify-content: space-between;
                    gap: var(--ga-space-3, 1rem);
                    flex-wrap: wrap;
                    align-items: flex-start;
                }
                .bp-eyebrow {
                    font-size: 0.75rem;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: var(--bp-accent);
                    font-weight: 900;
                    margin-bottom: 0.45rem;
                }
                .bp-title {
                    margin: 0;
                    font-size: clamp(1.55rem, 3vw, 2.35rem);
                    font-weight: 900;
                    letter-spacing: 0.03em;
                    text-transform: uppercase;
                    color: var(--color-white, #fff);
                }
                .bp-folio {
                    margin-top: 0.4rem;
                    opacity: 0.9;
                    font-size: 0.92rem;
                }
                .bp-hero-icon {
                    color: var(--bp-accent);
                }
                .bp-hero-meta {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(160px, 1fr));
                    gap: var(--ga-space-3, 1rem);
                    margin-top: var(--ga-space-4, 1.5rem);
                }
                .bp-hero-meta-card {
                    border: 1px solid rgba(255,255,255,0.22);
                    background: rgba(255,255,255,0.07);
                    padding: var(--ga-space-3, 1rem);
                }
                .bp-meta-label { font-size: 0.72rem; text-transform: uppercase; opacity: 0.76; margin-bottom: 0.2rem; font-weight: 700; }
                .bp-meta-value { font-weight: 900; }
                .bp-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: var(--ga-space-3, 1rem);
                    margin-bottom: var(--ga-space-4, 1.5rem);
                }
                .bp-stat-card {
                    border: 1px solid var(--bp-border);
                    border-left: 6px solid var(--bp-primary);
                    padding: var(--ga-space-3, 1rem);
                    background: var(--bp-surface);
                    box-shadow: var(--ga-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
                    min-height: 118px;
                }
                .bp-stat-card--danger { border-left-color: var(--bp-danger); }
                .bp-stat-card--warning { border-left-color: var(--bp-secondary); }
                .bp-stat-card--primary { border-left-color: var(--bp-info); }
                .bp-stat-card--accent { border-left-color: var(--bp-accent); }
                .bp-stat-head {
                    display: flex;
                    justify-content: space-between;
                    color: var(--bp-muted);
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    font-weight: 900;
                }
                .bp-stat-value {
                    margin-top: 0.6rem;
                    color: var(--bp-primary);
                    font-size: 1.65rem;
                    font-weight: 900;
                    line-height: 1.05;
                }
                .bp-stat-card--danger .bp-stat-value { color: var(--bp-danger); }
                .bp-stat-card--warning .bp-stat-value { color: var(--bp-secondary); }
                .bp-stat-card--accent .bp-stat-value { color: var(--bp-primary-dark); }
                .bp-stat-subvalue { color: var(--bp-muted); font-size: 0.82rem; margin-top: 0.45rem; }
                .bp-section-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--ga-space-3, 1rem);
                    margin-bottom: var(--ga-space-4, 1.5rem);
                }
                .bp-card {
                    background: var(--bp-surface);
                    border: 1px solid var(--bp-border);
                    padding: var(--ga-space-3, 1rem);
                    box-shadow: var(--ga-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
                }
                .bp-card-title {
                    display: flex;
                    align-items: center;
                    gap: 0.55rem;
                    margin: 0 0 0.9rem;
                    color: var(--bp-primary);
                    font-size: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    font-weight: 900;
                }
                .bp-highlight-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ga-space-3, 1rem); }
                .bp-highlight {
                    padding: var(--ga-space-3, 1rem);
                    background: var(--color-gray-100, #F8F9FA);
                    border: 1px solid var(--bp-border);
                    border-top: 4px solid var(--bp-secondary);
                }
                .bp-highlight--danger { border-top-color: var(--bp-danger); }
                .bp-highlight-label { color: var(--bp-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 900; }
                .bp-highlight-value { margin-top: 0.4rem; font-size: 1.45rem; font-weight: 900; color: var(--bp-danger); }
                .bp-highlight-note { color: var(--bp-muted); font-size: 0.84rem; margin-top: 0.25rem; }
                .bp-highlight-detail { margin-top: 0.55rem; display: grid; gap: 0.2rem; font-size: 0.86rem; }
                .bp-chart-list { display: grid; gap: 0.75rem; }
                .bp-chart-row { display: grid; grid-template-columns: 150px 1fr 100px; gap: 0.75rem; align-items: center; }
                .bp-chart-label { font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .bp-chart-track { height: 14px; background: var(--color-gray-200, #E9ECEF); overflow: hidden; border: 1px solid var(--bp-border); }
                .bp-chart-fill { height: 100%; background: linear-gradient(90deg, var(--bp-secondary), var(--bp-danger)); }
                .bp-chart-value { font-weight: 900; color: var(--bp-danger); text-align: right; }
                .bp-defect-grid { display: grid; gap: 0.85rem; }
                .bp-defect-row { display: grid; grid-template-columns: 155px 1fr 86px; gap: 0.75rem; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid var(--bp-border); }
                .bp-defect-row:last-child { border-bottom: none; padding-bottom: 0; }
                .bp-defect-name { display: flex; gap: 0.5rem; align-items: center; font-size: 0.88rem; font-weight: 700; color: var(--bp-text); }
                .bp-dot { width: 12px; height: 12px; display: inline-block; }
                .bp-dot--danger, .bp-defect-fill--danger { background: var(--bp-danger); }
                .bp-dot--orange, .bp-defect-fill--orange { background: var(--bp-secondary); }
                .bp-dot--warning, .bp-defect-fill--warning { background: #B35800; }
                .bp-dot--gray, .bp-defect-fill--gray { background: var(--bp-primary); }
                .bp-dot--teal, .bp-defect-fill--teal { background: var(--bp-info); }
                .bp-dot--lime, .bp-defect-fill--lime { background: var(--bp-accent); }
                .bp-dot--primary, .bp-defect-fill--primary { background: var(--bp-primary-dark); }
                .bp-dot--muted, .bp-defect-fill--muted { background: var(--bp-muted); }
                .bp-defect-bars { display: grid; grid-template-columns: 68px 1fr; gap: 0.25rem 0.55rem; align-items: center; }
                .bp-mini-label { font-size: 0.68rem; text-transform: uppercase; color: var(--bp-muted); font-weight: 900; letter-spacing: 0.04em; }
                .bp-defect-bar { height: 10px; background: var(--color-gray-200, #E9ECEF); overflow: hidden; border: 1px solid var(--bp-border); }
                .bp-defect-fill { height: 100%; }
                .bp-defect-fill--soft { opacity: 0.55; }
                .bp-defect-values { display: grid; gap: 0.18rem; text-align: right; font-size: 0.84rem; }
                .bp-defect-values span { color: var(--bp-muted); }
                .bp-executive-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.7rem;
                    padding: 0.95rem 1rem;
                    margin-bottom: 1rem;
                    border-left: 5px solid var(--bp-accent);
                    background: rgba(188,195,0,0.08);
                    color: var(--bp-primary-dark);
                    font-weight: 700;
                }
                .bp-pareto { display: grid; gap: 0.75rem; }
                .bp-pareto-row {
                    display: grid;
                    grid-template-columns: 38px minmax(210px, 280px) 1fr;
                    gap: 0.85rem;
                    align-items: center;
                    padding: 0.75rem;
                    border: 1px solid var(--bp-border);
                    background: var(--color-white, #FFFFFF);
                }
                .bp-pareto-row--main {
                    border-left: 6px solid var(--bp-accent);
                    background: linear-gradient(90deg, rgba(188,195,0,0.11), var(--color-white, #FFFFFF));
                }
                .bp-pareto-rank {
                    width: 32px;
                    height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bp-primary);
                    color: var(--color-white, #fff);
                    font-weight: 900;
                }
                .bp-pareto-row--main .bp-pareto-rank {
                    background: var(--bp-accent);
                    color: var(--bp-text);
                }
                .bp-pareto-name {
                    display: flex;
                    gap: 0.6rem;
                    align-items: center;
                    min-width: 0;
                }
                .bp-pareto-name strong {
                    display: block;
                    color: var(--bp-text);
                    line-height: 1.15;
                }
                .bp-pareto-name span:last-child {
                    display: block;
                    color: var(--bp-muted);
                    font-size: 0.82rem;
                    margin-top: 0.18rem;
                }
                .bp-pareto-bars { display: grid; gap: 0.35rem; }
                .bp-pareto-track {
                    height: 18px;
                    border: 1px solid var(--bp-border);
                    background: var(--color-gray-200, #E9ECEF);
                    overflow: hidden;
                }
                .bp-pareto-fill { height: 100%; min-width: 2px; }
                .bp-pareto-row--main .bp-pareto-fill {
                    background: linear-gradient(90deg, var(--bp-accent), var(--bp-info));
                }
                .bp-pareto-meta {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                    font-size: 0.78rem;
                    color: var(--bp-muted);
                }
                .bp-donut-layout {
                    display: grid;
                    grid-template-columns: 190px 1fr;
                    gap: 1rem;
                    align-items: center;
                }
                .bp-donut {
                    width: 180px;
                    height: 180px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
                }
                .bp-donut-hole {
                    width: 104px;
                    height: 104px;
                    border-radius: 50%;
                    background: var(--bp-surface);
                    display: grid;
                    place-items: center;
                    align-content: center;
                    border: 1px solid var(--bp-border);
                    color: var(--bp-primary);
                    text-align: center;
                    line-height: 1.1;
                }
                .bp-donut-hole strong { font-size: 1rem; }
                .bp-donut-hole span { font-size: 0.72rem; color: var(--bp-muted); text-transform: uppercase; }
                .bp-donut-legend { display: grid; gap: 0.45rem; }
                .bp-donut-legend-row {
                    display: grid;
                    grid-template-columns: 14px 1fr auto;
                    align-items: center;
                    gap: 0.55rem;
                    font-size: 0.86rem;
                    padding-bottom: 0.4rem;
                    border-bottom: 1px solid var(--bp-border);
                }
                .bp-table-wrap { overflow-x: auto; border: 1px solid var(--bp-border); background: var(--bp-surface); margin-bottom: var(--ga-space-4, 1.5rem); }
                .bp-table { width: 100%; border-collapse: collapse; min-width: 1080px; font-size: 0.9rem; }
                .bp-table th, .bp-table td { padding: 0.75rem 0.85rem; border-bottom: 1px solid var(--bp-border); text-align: left; }
                .bp-table th { background: var(--color-gray-100, #F8F9FA); color: var(--bp-primary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 900; }
                .bp-table tr:hover td { background: rgba(188,195,0,0.05); }
                .bp-row-danger td { background: rgba(192,57,43,0.08); }
                .bp-badge {
                    display: inline-flex;
                    align-items: center;
                    margin-top: 0.25rem;
                    padding: 0.25em 0.7em;
                    font-size: 0.72em;
                    font-weight: 900;
                    text-transform: uppercase;
                    background: rgba(192,57,43,0.12);
                    color: var(--bp-danger);
                }
                .bp-gallery-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ga-space-3, 1rem); }
                .bp-photo-card { border: 1px solid var(--bp-border); background: var(--bp-surface); overflow: hidden; box-shadow: var(--ga-shadow-sm, 0 1px 2px rgba(0,0,0,0.05)); page-break-inside: avoid; }
                .bp-photo-head { padding: 0.8rem 0.95rem; background: var(--color-gray-100, #F8F9FA); border-bottom: 1px solid var(--bp-border); display: flex; justify-content: space-between; gap: 1rem; }
                .bp-photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; padding: 0.9rem; }
                .bp-photo-img { width: 100%; height: 220px; object-fit: cover; display: block; cursor: zoom-in; background: var(--color-gray-100, #F8F9FA); border: 1px solid var(--bp-border); }
                .bp-empty { color: var(--bp-muted); font-style: italic; padding: 0.9rem; border: 1px dashed var(--bp-border); background: var(--color-gray-100, #F8F9FA); }
                .bp-loading, .bp-error { padding: 2rem; text-align: center; color: var(--bp-muted); }
                .bp-error { display: flex; justify-content: center; align-items: center; gap: 0.7rem; color: var(--bp-danger); }
                .bp-section-heading { color: var(--bp-primary); text-transform: uppercase; letter-spacing: 0.06em; }
                @media (max-width: 1100px) {
                    .bp-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .bp-section-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 760px) {
                    .bp-stats-grid, .bp-highlight-grid, .bp-gallery-grid, .bp-hero-meta { grid-template-columns: 1fr; }
                    .bp-toolbar { align-items: stretch; flex-direction: column; }
                    .bp-chart-row { grid-template-columns: 1fr; gap: 0.25rem; }
                    .bp-chart-value { text-align: left; }
                    .bp-defect-row { grid-template-columns: 1fr; }
                    .bp-defect-values { text-align: left; grid-template-columns: auto auto; justify-content: start; gap: 0.75rem; }
                    .bp-pareto-row { grid-template-columns: 1fr; }
                    .bp-pareto-rank { width: 28px; height: 28px; }
                    .bp-donut-layout { grid-template-columns: 1fr; justify-items: start; }
                    .bp-photo-grid { grid-template-columns: 1fr; }
                }
                @media print {
                    .no-print { display: none !important; }
                    .bp-report-page { background: white !important; padding: 0 !important; }
                    .bp-hero { color: #111 !important; background: white !important; border: 1px solid #ddd !important; border-top: 5px solid var(--bp-accent) !important; box-shadow: none !important; }
                    .bp-title { color: #111 !important; }
                    .bp-hero-icon { display: none; }
                    .bp-card, .bp-stat-card, .bp-photo-card { box-shadow: none !important; border: 1px solid #ddd !important; }
                    .bp-section-grid { grid-template-columns: 1fr 1fr; }
                    .bp-photo-img { height: 150px; }
                }
            `}</style>

            <div className="bp-toolbar no-print">
                <button onClick={() => navigate(-1)} className="ga-btn ga-btn--text">
                    <ArrowLeft size={18} className="u-mr-2" /> Volver
                </button>
                <button onClick={() => window.print()} className="ga-btn ga-btn--primary">
                    <Printer size={18} className="u-mr-2" /> Imprimir Reporte
                </button>
            </div>

            <section className="bp-hero">
                <div className="bp-hero-top">
                    <div>
                        <div className="bp-eyebrow">Control de pérdida por piezas quebradas</div>
                        <h1 className="bp-title">Reporte de Piezas Quebradas</h1>
                        <div className="bp-folio">Folio #{study.id} — {formattedDate}</div>
                    </div>
                    <FileText size={40} className="bp-hero-icon" />
                </div>
                <div className="bp-hero-meta">
                    <div className="bp-hero-meta-card">
                        <div className="bp-meta-label">Supervisor</div>
                        <div className="bp-meta-value">{study.supervisor || 'Sin informar'}</div>
                    </div>
                    <div className="bp-hero-meta-card">
                        <div className="bp-meta-label">Responsable</div>
                        <div className="bp-meta-value">{study.responsible || 'Sin informar'}</div>
                    </div>
                </div>
            </section>

            <section className="bp-stats-grid">
                <StatCard label="Total piezas" value={nf.format(report.totalPieces)} subvalue="piezas evaluadas" icon={BarChart3} />
                <StatCard label="Volumen total" value={`${formatM3(report.totalM3)} m³`} subvalue="volumen teórico" tone="primary" />
                <StatCard label="Volumen pérdida" value={`${formatM3(report.totalLossM3)} m³`} subvalue="volumen afectado" tone="danger" />
                <StatCard label="Pérdida total" value={formatPercent(study.total_loss_percentage)} subvalue={`${nf1.format(report.lossM3PerThousandPieces)} m³ / 1.000 piezas`} tone="warning" />
            </section>

            <section className="bp-section-grid">
                <div className="bp-card">
                    <h3 className="bp-card-title"><AlertTriangle size={18} /> Conclusiones del estudio</h3>
                    
                    <div className="bp-highlight-grid">
                        <div className="bp-highlight bp-highlight--danger">
                            <div className="bp-highlight-label">Atributo con mayor pérdida</div>
                            {report.mainLossAttribute ? (
                                <>
                                    <div className="bp-highlight-value">{report.mainLossAttribute.label}</div>
                                    <div className="bp-highlight-detail">
                                        <span><strong>{formatM3(report.mainLossAttribute.lossM3, 4)} m³</strong> de pérdida estimada</span>
                                        <span>{nf.format(report.mainLossAttribute.count)} piezas asociadas</span>
                                        {report.mainLossAttribute.topLotCode ? <span>Mayor impacto en lote <strong>{report.mainLossAttribute.topLotCode}</strong></span> : null}
                                    </div>
                                </>
                            ) : <div className="bp-highlight-note">Sin datos disponibles.</div>}
                        </div>  
                         <div className="bp-highlight bp-highlight--danger">
                            <div className="bp-highlight-label">Piezas quebradas por móvil</div>
                            {report.mobileLossCount? (
                                <>
                                    <div className="bp-highlight-value">{report.mobileLossVol}</div>
                                    <div className="bp-highlight-detail">
                                        <span><strong>{formatM3(report.mobileLossVol, 4)} m³</strong> de pérdida estimada</span>
                                        <span>{nf.format(report.mobileLossCount)} piezas asociadas</span>
                                        {report.mainLossAttribute.topLotCode ? <span>Mayor impacto en lote <strong>{report.mainLossAttribute.topLotCode}</strong></span> : null}
                                    </div>
                                </>
                            ) : <div className="bp-highlight-note">Sin datos disponibles.</div>}
                        </div>
                    </div>
                    <div className="bp-highlight-grid">
                       
                       
                    </div>
                    
                    <div className="bp-highlight-detail" style={{ marginTop: '1rem' }}>
                        <span>
                            Piezas quebradas por móvil: <strong>{nf.format(report.mobileLossCount)}</strong> piezas · <strong>{formatM3(report.mobileLossVol, 4)} m³</strong> de pérdida estimada
                        </span>
                    </div>
                </div>

                <div className="bp-card">
                    <h3 className="bp-card-title"><TrendingUp size={18} /> Resumen por defecto</h3>
                    <div className="bp-highlight-detail">
                        <span>Total defectos: <strong>{nf.format(report.totalDefects)}</strong></span>
                        <span>Volumen estimado por atributos: <strong>{formatM3(report.totalDefectLossM3, 4)} m³</strong></span>
                        <span>Quebrada móvil: <strong>{formatM3(report.mobileLossVol, 4)} m³</strong></span>
                    </div>
                </div>
            </section>

            <section className="bp-card u-mb-6">
                <h3 className="bp-card-title"><BarChart3 size={18} /> Pareto de pérdidas por atributo</h3>
                {report.mainLossAttribute ? (
                    <div className="bp-executive-note">
                        <AlertTriangle size={20} />
                        <span>
                            Principal causa de pérdida: <strong>{report.mainLossAttribute.label}</strong>, con{' '}
                            <strong>{formatM3(report.mainLossAttribute.lossM3, 4)} m³</strong> y{' '}
                            <strong>{nf.format(report.mainLossAttribute.count)} eventos</strong> asociados.
                        </span>
                    </div>
                ) : null}
                <div className="bp-section-grid" style={{ marginBottom: 0 }}>
                    <div>
                        <ParetoLossChart rows={report.defectRows} />
                    </div>
                    <div>
                        <h4 className="bp-card-title" style={{ fontSize: '0.9rem', marginTop: 0 }}>
                            <PieChart size={17} /> Participación del volumen
                        </h4>
                        <VolumeShareDonut rows={report.defectRows} />
                    </div>
                </div>
            </section>

            <section className="bp-card u-mb-6">
                <h3 className="bp-card-title"><BarChart3 size={18} /> Top pérdidas por lote</h3>
                <LossBarChart lots={report.lots} />
            </section>

            <h3 className="u-text-lg u-font-bold u-mb-4 bp-section-heading">Detalle por lote</h3>
            <div className="bp-table-wrap">
                <table className="bp-table">
                    <thead>
                        <tr>
                            <th>Lote</th>
                            <th>Escuadría E/A/L</th>
                            <th>Pzas. teóricas</th>
                            <th>M³ teórico</th>
                            <th>Total defectos</th>
                            <th>Atributo principal</th>
                            <th>Vol. pérdida</th>
                            <th>% pérdida</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.lots.map((lot) => {
                            const totalDefects = getDefectTotal(lot);
                            const topAttr = DEFECT_FIELDS
                                .map((field) => ({ ...field, count: getDefectCount(lot, field.key), lossM3: getEstimatedDefectLossM3(lot, field.key) }))
                                .sort((a, b) => b.lossM3 - a.lossM3 || b.count - a.count)[0];
                            const isMaxLoss = report.maxLossLot && report.maxLossLot.id === lot.id;
                            return (
                                <tr key={lot.id || lot.lot_code} className={isMaxLoss ? 'bp-row-danger' : ''}>
                                    <td className="u-font-bold">
                                        {lot.lot_code}
                                        {isMaxLoss ? <div className="bp-badge">Mayor lote</div> : null}
                                    </td>
                                    <td>{lot.thickness} x {lot.width} x {lot.length}</td>
                                    <td>{nf.format(asNumber(lot.pieces_theoretical))}</td>
                                    <td>{formatM3(lot.m3_theoretical)}</td>
                                    <td>{nf.format(totalDefects)}</td>
                                    <td>{topAttr?.count > 0 ? `${topAttr.short} (${nf.format(topAttr.count)})` : 'Sin defecto'}</td>
                                    <td className="u-danger u-bold">{formatM3(lot.loss_m3, 4)}</td>
                                    <td className="u-danger u-bold">{formatPercent(lot.loss_percentage)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <h3 className="u-text-lg u-font-bold u-mb-4 bp-section-heading"><Camera size={18} className="u-mr-2" /> Evidencia fotográfica</h3>
            <div className="bp-gallery-grid">
                {report.lotsWithImages.map((lot) => {
                    const urls = getImageUrls(lot.image_path);
                    return (
                        <div key={lot.id || lot.lot_code} className="bp-photo-card">
                            <div className="bp-photo-head">
                                <strong>Lote: {lot.lot_code}</strong>
                                <span className="u-danger u-bold">Pérdida: {formatPercent(lot.loss_percentage)}</span>
                            </div>
                            <div className="bp-photo-grid">
                                {urls.map((fullUrl, index) => (
                                    <img
                                        key={`${lot.id}-${index}`}
                                        src={fullUrl}
                                        alt={`Evidencia lote ${lot.lot_code} - ${index + 1}`}
                                        className="bp-photo-img"
                                        onClick={() => window.open(fullUrl, '_blank')}
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = 'https://via.placeholder.com/420x280?text=Imagen+No+Disponible';
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
                {!report.lotsWithImages.length ? (
                    <div className="bp-empty">No hay evidencia fotográfica registrada.</div>
                ) : null}
            </div>
        </div>
    );
};

export default BrokenPiecesReport;
