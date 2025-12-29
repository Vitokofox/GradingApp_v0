import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import MasterDataConfig from './pages/MasterDataConfig';
import Dashboard from './pages/Dashboard';
import RegistryForm from './components/RegistryForm';
import InspectionForm from './components/InspectionForm';
import GradingInterface from './pages/GradingInterface';
import InspectionsList from './pages/InspectionsList';
import InspectionReport from './pages/InspectionReport';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/layout/Layout';
import FinscanStudy from './pages/FinscanStudy';
import InlineGradeReport from './pages/InlineGradeReport';
import FinishedGradeReport from './pages/FinishedGradeReport';

function App() {
  return (
    <Router>
      <AuthProvider>
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
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
