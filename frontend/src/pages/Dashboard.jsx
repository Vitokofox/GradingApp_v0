import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Layers, Activity, AlertTriangle, ArrowRight } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const activities = [
        {
            id: 'finished-product',
            title: 'Grado Producto Terminado',
            description: 'Inspección final de calidad y clasificación',
            icon: Layers,
            color: 'from-emerald-500 to-teal-500',
            path: '/process/finished-product'
        },
        {
            id: 'line-grading',
            title: 'Grado en Línea',
            description: 'Monitoreo continuo del proceso de producción',
            icon: Activity,
            color: 'from-blue-500 to-indigo-500',
            path: '/process/line-grading'
        },
        {
            id: 'rejection-typing',
            title: 'Tipificación de Rechazo',
            description: 'Análisis y categorización de material rechazado',
            icon: AlertTriangle,
            color: 'from-amber-500 to-orange-500',
            path: '/process/rejection-typing'
        },
        {
            id: 'finscan-study',
            title: 'Estudio Finscan',
            description: 'Comparativa de clasificación Scanner vs Inspector',
            icon: Activity, // Reusing Activity or import Scan from lucide-react if available. Activity is imported.
            color: 'from-purple-500 to-pink-500',
            path: '/process/finscan'
        }
    ];

    const processColor = user?.process_type === 'Seco' ? 'text-amber-400' : 'text-emerald-400';
    const processBg = user?.process_type === 'Seco' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';

    return (
        <div className="ga-stack">
            <div className="u-center u-mb-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`ga-badge ga-badge--${user?.process_type === 'Seco' ? 'warn' : 'ok'}`}
                    style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem' }}
                >
                    <span className="u-bold uppercase" style={{ fontSize: '0.875rem' }}>Proceso {user?.process_type || 'General'}</span>
                </motion.div>

                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--ga-text)' }}>
                    Centro de Actividades
                </h1>
                <p className="u-muted" style={{ maxWidth: '600px', margin: '0 auto', fontSize: '1.125rem' }}>
                    Seleccione una actividad para comenzar el registro de datos y supervisión del proceso.
                </p>
            </div>

            <div className="ga-grid ga-grid--2">
                {activities.map((activity, index) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -5 }}
                        className="ga-card"
                        style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid var(--ga-accent)' }}
                        onClick={() => navigate(activity.path)}
                    >
                        <div className="ga-card__body ga-stack">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: 'var(--ga-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <activity.icon size={24} color="var(--ga-accent)" />
                                </div>
                                <h3 className="ga-card__title">{activity.title}</h3>
                            </div>

                            <p className="u-muted" style={{ fontSize: '0.875rem', minHeight: '40px' }}>
                                {activity.description}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--ga-primary)', fontWeight: 500, fontSize: '0.875rem', marginTop: 'auto' }}>
                                Comenzar <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
