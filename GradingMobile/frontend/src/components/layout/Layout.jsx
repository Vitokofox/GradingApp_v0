import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isNative = Boolean(window?.Capacitor?.isNativePlatform?.());

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className={`ga-app${isNative ? ' ga-app--native' : ''}`}>
            {/* Navbar */}
            <nav className="ga-topbar">
                <div className="ga-container ga-topbar__container">
                    <div className="ga-topbar__row">
                        <div className="ga-topbar__left">
                            <Link to="/" className="ga-topbar__brand u-bold">
                                Grading App
                            </Link>

                            <div className="u-flex u-gap-4">
                                <div className="ga-topbar__links">
                                    <Link to="/" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        Inspección
                                    </Link>
                                    <Link to="/inspections" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        Historial
                                    </Link>
                                    <Link to="/sync" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        Sincronizar
                                    </Link>
                                    {user?.level === 'admin' && (
                                        <Link to="/admin" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                            Panel Admin
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="ga-topbar__right">
                            <div className="ga-badge ga-badge--muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                                {user?.level === 'admin' ? <Shield size={16} /> : <UserIcon size={16} />}
                                <span>{user?.first_name} {user?.last_name}</span>
                            </div>

                            <button
                                onClick={handleLogout}
                                style={{ padding: '0.5rem', color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                title="Cerrar Sesión"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="ga-page ga-page--app">
                {children}
            </main>
        </div>
    );
};

export default Layout;
