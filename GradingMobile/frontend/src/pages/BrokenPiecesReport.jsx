import React, { useState, useEffect } from 'react';
import api from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Printer, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const BrokenPiecesReport = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [study, setStudy] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStudy = async () => {
            try {
                const res = await api.get(`/broken-pieces/${id}`);
                setStudy(res.data);
            } catch (error) {
                console.error("Error fetching study", error);
                alert("Error cargando el reporte");
            } finally {
                setLoading(false);
            }
        };
        fetchStudy();
    }, [id]);

    if (loading) return <div className="u-p-8 u-text-center">Cargando Reporte...</div>;
    if (!study) return <div className="u-p-8 u-text-center">Estudio no encontrado</div>;

    const formattedDate = new Date(study.date).toLocaleDateString() + ' ' + new Date(study.date).toLocaleTimeString();

    // Calculations for Conclusions
    let maxLossLot = null;
    let maxLossVal = -1;
    let mobileLossVol = 0;

    study.lots.forEach(lot => {
        // Max Loss
        if (lot.loss_percentage > maxLossVal) {
            maxLossVal = lot.loss_percentage;
            maxLossLot = lot;
        }

        // Mobile Loss
        // Calculate Unit M3
        let unitM3 = 0;
        if (lot.pieces_theoretical > 0) {
            unitM3 = lot.m3_theoretical / lot.pieces_theoretical;
        }
        mobileLossVol += (lot.broken_mobile * unitM3);
    });

    return (
        <div className="ga-page ga-report-page">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .ga-report-page { background: white; padding: 0; }
                    .ga-card { box-shadow: none; border: 1px solid #ddd; }
                }
            `}</style>

            {/* Header Actions */}
            <div className="u-flex u-justify-between u-items-center u-mb-6 no-print">
                <button onClick={() => navigate(-1)} className="ga-btn ga-btn--text">
                    <ArrowLeft size={18} className="u-mr-2" /> Volver
                </button>
                <button onClick={() => window.print()} className="ga-btn ga-btn--primary">
                    <Printer size={18} className="u-mr-2" /> Imprimir Reporte
                </button>
            </div>

            {/* Report Header */}
            <div className="ga-card u-mb-6">
                <div className="u-text-center u-mb-6">
                    <h1 className="u-text-2xl u-font-bold u-uppercase">Reporte de Piezas Quebradas</h1>
                    <p className="u-text-sm u-color-text-secondary">Folio #{study.id} — {formattedDate}</p>
                </div>

                <div className="ga-grid ga-grid--3 u-gap-4 u-text-sm">
                    <div>
                        <strong>Supervisor:</strong> {study.supervisor}
                    </div>
                    <div>
                        <strong>Responsable:</strong> {study.responsible}
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="ga-grid ga-grid--4 u-gap-4 u-mb-6">
                <div className="ga-card u-text-center u-bg-gray-50">
                    <div className="u-text-xs u-uppercase u-color-text-secondary">Total Piezas</div>
                    <div className="u-text-xl u-font-bold">{study.total_pieces}</div>
                </div>
                <div className="ga-card u-text-center u-bg-gray-50">
                    <div className="u-text-xs u-uppercase u-color-text-secondary">Volumen Total (m³)</div>
                    <div className="u-text-xl u-font-bold">{study.total_m3.toFixed(3)}</div>
                </div>
                <div className="ga-card u-text-center u-bg-red-50">
                    <div className="u-text-xs u-uppercase u-color-danger">Volumen Pérdida (m³)</div>
                    <div className="u-text-xl u-font-bold u-color-danger">{study.total_loss_m3.toFixed(3)}</div>
                </div>
                <div className="ga-card u-text-center u-bg-red-50">
                    <div className="u-text-xs u-uppercase u-color-danger">% Pérdida Total</div>
                    <div className="u-text-xl u-font-bold u-color-danger">{(study.total_loss_percentage * 100).toFixed(2)}%</div>
                </div>
            </div>

            {/* Conclusions / Highlights */}
            <div className="ga-card u-mb-6 u-bg-blue-50 u-border-blue-200">
                <h3 className="u-text-lg u-font-bold u-mb-3 u-color-text-primary">Conclusiones del Estudio</h3>
                <div className="ga-grid ga-grid--2 u-gap-6">
                    <div>
                        <div className="u-text-sm u-uppercase u-color-text-secondary u-mb-1">Mayor Pérdida Registrada</div>
                        {maxLossLot ? (
                            <div>
                                <div className="u-text-xl u-font-bold u-color-danger">
                                    {(maxLossLot.loss_percentage * 100).toFixed(2)}%
                                </div>
                                <div className="u-text-sm">
                                    Lote: <strong>{maxLossLot.lot_code}</strong> <br />
                                    ({maxLossLot.loss_m3.toFixed(4)} m³)
                                </div>
                            </div>
                        ) : (
                            <div>N/A</div>
                        )}
                    </div>
                    <div>
                        <div className="u-text-sm u-uppercase u-color-text-secondary u-mb-1">Pérdida por Pieza Quebrada (Móvil)</div>
                        <div className="u-text-xl u-font-bold u-color-danger">
                            {mobileLossVol.toFixed(4)} m³
                        </div>
                        <div className="u-text-sm">
                            Impacto Global
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <h3 className="u-text-lg u-font-bold u-mb-4">Detalle por Lote</h3>
            <div className="u-overflow-x-auto u-mb-8">
                <table className="ga-table ga-table--bordered u-text-sm">
                    <thead className="u-bg-gray-100">
                        <tr>
                            <th>Lote</th>
                            <th>Escuadría (E/A/L)</th>
                            <th>M³ Teórico</th>
                            <th title="Total Defectos">Def.</th>
                            <th title="Quebrada Movil">Q.Movil</th>
                            <th>Vol. Pérdida</th>
                            <th>% Pérdida</th>
                        </tr>
                    </thead>
                    <tbody>
                        {study.lots.map(lot => {
                            const totalDefects = lot.broken_mobile + lot.broken_sawmill + lot.broken_knot + lot.missing_pieces +
                                lot.over_width + lot.under_width + lot.warped + lot.in_process;
                            return (
                                <tr key={lot.id} className={maxLossLot && maxLossLot.id === lot.id ? "u-bg-red-50" : ""}>
                                    <td className="u-font-bold">{lot.lot_code}</td>
                                    <td>{lot.thickness} x {lot.width} x {lot.length}</td>
                                    <td>{lot.m3_theoretical.toFixed(3)}</td>
                                    <td>{totalDefects}</td>
                                    <td className={lot.broken_mobile > 0 ? "u-font-bold u-color-danger" : ""}>{lot.broken_mobile}</td>
                                    <td className="u-color-danger u-font-bold">{lot.loss_m3.toFixed(4)}</td>
                                    <td className="u-color-danger">{(lot.loss_percentage * 100).toFixed(2)}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Photo Gallery */}
            <h3 className="u-text-lg u-font-bold u-mb-4">Evidencia Fotográfica</h3>
            <div className="ga-grid ga-grid--2 u-gap-6">
                {study.lots.filter(l => l.image_path).map(lot => (
                    <div key={lot.id} className="ga-card u-p-0 u-overflow-hidden" style={{ pageBreakInside: 'avoid' }}>
                        <div className="u-p-3 u-bg-gray-50 u-border-b u-flex u-justify-between">
                            <strong>Lote: {lot.lot_code}</strong>
                            <div className="u-text-xs u-color-danger u-font-bold">Pérdida: {(lot.loss_percentage * 100).toFixed(2)}%</div>
                        </div>
                        <div className="u-p-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {lot.image_path.split(';').map((imgUrl, i) => {
                                const fullUrl = imgUrl.startsWith('http') ? imgUrl : `${api.defaults.baseURL}${imgUrl}`;
                                return (
                                    <div key={i} className="u-shadow-md u-rounded u-overflow-hidden u-bg-white">
                                        <img
                                            src={fullUrl}
                                            alt={`Evidencia Lote ${lot.lot_code} - ${i + 1}`}
                                            className="u-w-full u-h-auto u-block"
                                            style={{ cursor: 'zoom-in' }}
                                            onClick={() => window.open(fullUrl, '_blank')}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x300?text=Imagen+No+Disponible'; }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {study.lots.filter(l => l.image_path).length === 0 && (
                    <div className="u-text-muted u-italic u-p-4 u-border u-rounded u-bg-gray-50">No hay evidencia fotográfica registrada.</div>
                )}
            </div>
        </div>
    );
};

export default BrokenPiecesReport;
