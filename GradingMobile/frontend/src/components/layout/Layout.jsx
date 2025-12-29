import React, { useContext } from 'react';
import { useAuth } from '../../context/AuthContext';
import { NetworkContext } from '../../context/NetworkContext';
import { LogOut, User as UserIcon, Shield, RefreshCw, WifiOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const { status, pendingCount, syncInspections } = useContext(NetworkContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-8">
                            <Link to="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                                Grading App
                            </Link>

                            {/* Offline Indicator */}
                            {!status.connected && (
                                <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 border border-red-500/50 rounded-full text-xs text-red-200">
                                    <WifiOff className="w-3 h-3" />
                                    <span>Offline</span>
                                </div>
                            )}

                            <div className="hidden md:flex items-center gap-4">
                                <Link to="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                    Inspección
                                </Link>
                                <Link to="/inspections" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                    Historial
                                </Link>
                                {user?.level === 'admin' && (
                                    <Link to="/admin" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                        Panel Admin
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sync Button */}
                            {pendingCount > 0 && (
                                <button
                                    onClick={syncInspections}
                                    disabled={!status.connected}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${status.connected
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                                            : 'bg-slate-700/50 text-slate-400 cursor-not-allowed'
                                        }`}
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Sync ({pendingCount})</span>
                                </button>
                            )}

                            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                                {user?.level === 'admin' ? <Shield className="w-4 h-4 text-purple-400" /> : <UserIcon className="w-4 h-4 text-blue-400" />}
                                <span>{user?.first_name} {user?.last_name}</span>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                                title="Cerrar Sesión"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;
