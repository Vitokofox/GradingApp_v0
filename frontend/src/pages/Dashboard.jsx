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
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-12 text-center">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 ${processBg} ${processColor}`}
                >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span className="font-semibold uppercase tracking-wider text-sm">Proceso {user?.process_type || 'General'}</span>
                </motion.div>

                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                    Centro de Actividades
                </h1>
                <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                    Seleccione una actividad para comenzar el registro de datos y supervisión del proceso.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {activities.map((activity, index) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -5 }}
                        className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 overflow-hidden hover:bg-slate-800 transition-all cursor-pointer"
                        onClick={() => navigate(activity.path)}
                    >
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br ${activity.color}`} />

                        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${activity.color} flex items-center justify-center mb-6 shadow-lg`}>
                            <activity.icon className="w-7 h-7 text-white" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{activity.title}</h3>
                        <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                            {activity.description}
                        </p>

                        <div className="flex items-center text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                            Comenzar <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
