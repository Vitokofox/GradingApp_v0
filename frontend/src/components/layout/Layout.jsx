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
        <div className="ga-app">
            {/* Navbar */}
            <nav className="ga-topbar" style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50 }}>
                <div className="ga-container">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <Link to="/" className="u-bold" style={{ fontSize: '1.25rem', color: 'var(--color-white)' }}>
                                Grading App
                            </Link>

                            <div className="u-flex u-gap-4">
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <Link to="/" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        Inspección
                                    </Link>
                                    <Link to="/inspections" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                        Historial
                                    </Link>
                                    {user?.level === 'admin' && (
                                        <Link to="/admin" className="u-text-sm u-bold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                                            Panel Admin
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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

            <main className="ga-page" style={{ paddingTop: '80px' }}>
                {children}
            </main>
        </div>
    );
};

export default Layout;
