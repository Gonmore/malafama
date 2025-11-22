import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Páginas
import Login from './pages/Login'
import OnboardingWizard from './pages/onboarding/OnboardingWizard'
import LocalesView from './pages/admin/LocalesView'
import LocalDashboard from './pages/admin/LocalDashboard'
import UsuariosManagement from './pages/admin/UsuariosManagement'
import ReportesPage from './pages/admin/ReportesPage'
import ProductosManagement from './pages/admin/ProductosManagement'
import AdminDashboardOld from './pages/admin/Dashboard'
import MeseroView from './pages/mesero/MeseroView'
import CocinaView from './pages/cocina/CocinaView'
import BarView from './pages/bar/BarView'
import AtencionDashboard from './pages/atencion/Dashboard'
import CocinaDashboard from './pages/cocina/Dashboard'
import ProveedorDashboard from './pages/proveedor/Dashboard'
import Footer from './components/Footer'

// Layout
import Layout from './components/Layout'

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <div className="min-h-screen pb-10">
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={
          <ProtectedRoute role="admin" requireOnboarding={false}>
            <OnboardingWizard />
          </ProtectedRoute>
        } />
        
        {/* Rutas protegidas */}
        <Route path="/admin" element={
          <ProtectedRoute role="admin">
            <LocalesView />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/local/:localId" element={
          <ProtectedRoute role="admin">
            <LocalDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin/dashboard" element={
          <ProtectedRoute role="admin">
            <LocalesView />
          </ProtectedRoute>
        } />

        <Route path="/admin/usuarios" element={
          <ProtectedRoute role="admin">
            <UsuariosManagement />
          </ProtectedRoute>
        } />

        <Route path="/admin/reportes" element={
          <ProtectedRoute role="admin">
            <ReportesPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/productos" element={
          <ProtectedRoute role="admin">
            <ProductosManagement />
          </ProtectedRoute>
        } />
        
        <Route path="/mesero" element={
          <ProtectedRoute role="atencion">
            <MeseroView />
          </ProtectedRoute>
        } />
        
        <Route path="/cocina" element={
          <ProtectedRoute role="cocina">
            <CocinaView />
          </ProtectedRoute>
        } />
        
        <Route path="/bar" element={
          <ProtectedRoute role="bar">
            <BarView />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/*" element={
          <ProtectedRoute role="admin">
            <Layout>
              <AdminDashboardOld />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/atencion/*" element={
          <ProtectedRoute role="atencion">
            <Layout>
              <AtencionDashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/cocina/*" element={
          <ProtectedRoute role="cocina">
            <Layout>
              <CocinaDashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/proveedor/*" element={
          <ProtectedRoute role="proveedor">
            <Layout>
              <ProveedorDashboard />
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
      <Footer />
    </Router>
  )
}

// Componente de ruta protegida
function ProtectedRoute({ children, role, requireOnboarding = true }) {
  const { user, token } = useAuthStore()

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  // Permitir acceso si el rol coincide o si es admin (admin puede ver todo)
  if (role && user.tipo !== role && user.tipo !== 'admin') {
    return <Navigate to={`/${user.tipo}`} replace />
  }

  // Ya no redirigimos automáticamente al onboarding
  // El admin puede acceder manualmente desde el dashboard

  return children
}

export default App
