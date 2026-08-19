import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import MasterDataConfig from './pages/MasterDataConfig';
import Dashboard from './pages/Dashboard';
import Setup from './pages/Setup';
import GradingInterface from './pages/GradingInterface';
import InspectionsList from './pages/InspectionsList';
import InspectionReport from './pages/InspectionReport';
import FinscanStudy from './pages/FinscanStudy';
import InlineGradeReport from './pages/InlineGradeReport';
import FinishedGradeReport from './pages/FinishedGradeReport';
import BrokenPiecesStudy from './pages/BrokenPiecesStudy';
import BrokenPiecesReport from './pages/BrokenPiecesReport';
import LogQualityControl from './pages/LogQualityControl';
import LogQualityReport from './pages/LogQualityReport';
import TruckStudy from './pages/TruckStudy';
import TruckStudyReport from './pages/TruckStudyReport';
import SiniestradaStudy from './pages/SiniestradaStudy';
import SiniestradaReport from './pages/SiniestradaReport';
import Sync from './pages/Sync';

// Components
import Layout from './components/layout/Layout';
import RegistryForm from './components/RegistryForm';
import InspectionForm from './components/InspectionForm';
import PrivateRoute from './components/PrivateRoute';
import SetupGuard from './components/SetupGuard';

const APP_VERSION = "1.3.1";

function App() {
  const [needsSetup] = useState(() => {
    const setupCompleted = localStorage.getItem('setup_completed');
    const lastVersion = localStorage.getItem('app_version');
    return !setupCompleted || lastVersion !== APP_VERSION;
  });

  return (
    <Router>
      <AuthProvider>
        <MobileRuntimeEffects />
        <Routes>
          {/* Setup is always accessible if needed */}
          <Route path="/setup" element={<Setup />} />

          <Route path="*" element={
            needsSetup ? <Navigate to="/setup" replace /> : <MainRoutes />
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

function resolveFallbackPath(pathname) {
  if (pathname.startsWith('/inspections/')) return '/inspections';
  if (pathname.startsWith('/process/') && pathname.includes('/report/')) return '/inspections';
  if (pathname.startsWith('/process/')) return '/';
  if (pathname.startsWith('/admin/config')) return '/admin';
  if (pathname.startsWith('/admin')) return '/';
  if (pathname.startsWith('/sync')) return '/';
  return '/';
}

function MobileRuntimeEffects() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!window?.Capacitor?.isNativePlatform?.()) {
      return undefined;
    }

    let listenerHandle;

    const setupNativeRuntime = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        await StatusBar.setBackgroundColor({ color: '#5F5953' });
        await StatusBar.setStyle({ style: Style.Light });
      } catch (error) {
        console.warn('Status bar setup failed', error);
      }

      listenerHandle = await CapacitorApp.addListener('backButton', () => {
        const pathname = location.pathname;

        if (pathname !== '/' && pathname !== '/login' && pathname !== '/setup') {
          if (window.history.length > 1) {
            navigate(-1);
            return;
          }

          navigate(resolveFallbackPath(pathname), { replace: true });
          return;
        }
      });
    };

    setupNativeRuntime();

    return () => {
      listenerHandle?.remove?.();
    };
  }, [location.pathname, navigate]);

  return null;
}

function MainRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="finished-product" element={<InspectionForm type="finished_product" title="Producto Terminado" />} />
              <Route path="line-grading" element={<InspectionForm type="line_grading" title="Grado en Línea" />} />
              <Route path="rejection-typing" element={<InspectionForm type="rejection_typing" title="Tipificación de Rechazo" />} />
              <Route path=":type/:id/grading" element={<GradingInterface />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/finscan" element={
        <PrivateRoute>
          <Layout>
            <FinscanStudy />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/broken-pieces" element={
        <PrivateRoute>
          <Layout>
            <BrokenPiecesStudy />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/broken-pieces/report/:id" element={
        <PrivateRoute>
          <Layout>
            <BrokenPiecesReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/log-quality" element={
        <PrivateRoute>
          <Layout>
            <LogQualityControl />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/log-quality/report/:id" element={
        <PrivateRoute>
          <Layout>
            <LogQualityReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/truck-study" element={
        <PrivateRoute>
          <Layout>
            <TruckStudy />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/truck-study/report/:id" element={
        <PrivateRoute>
          <Layout>
            <TruckStudyReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/siniestrada" element={
        <PrivateRoute>
          <Layout>
            <SiniestradaStudy />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/process/siniestrada/report/:id" element={
        <PrivateRoute>
          <Layout>
            <SiniestradaReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/inspections" element={
        <PrivateRoute>
          <Layout>
            <InspectionsList />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/inspections/:id/report" element={
        <PrivateRoute>
          <Layout>
            <InspectionReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/inspections/:id/inline-report" element={
        <PrivateRoute>
          <Layout>
            <InlineGradeReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/inspections/:id/finished-report" element={
        <PrivateRoute>
          <Layout>
            <FinishedGradeReport />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/admin" element={
        <PrivateRoute roles={['admin']}>
          <Layout>
            <AdminDashboard />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/admin/config" element={
        <PrivateRoute roles={['admin']}>
          <Layout>
            <MasterDataConfig />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/sync" element={
        <PrivateRoute>
          <Layout>
            <Sync />
          </Layout>
        </PrivateRoute>
      } />

      {/* Default redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
