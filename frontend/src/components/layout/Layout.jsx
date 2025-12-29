import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
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
