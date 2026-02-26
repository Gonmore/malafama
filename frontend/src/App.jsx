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
import ProveedoresManagement from './pages/admin/ProveedoresManagement'
import MesasManagement from './pages/admin/MesasManagement'
import AdminDashboardOld from './pages/admin/Dashboard'
import MeseroView from './pages/mesero/MeseroView'
import CocinaView from './pages/cocina/CocinaView'
import BarView from './pages/bar/BarView'
import AtencionDashboard from './pages/atencion/Dashboard'
import CocinaDashboard from './pages/cocina/Dashboard'
import ProveedorDashboard from './pages/proveedor/Dashboard'
import Footer from './components/Footer'
import PlatformAdminDashboard from './pages/platformAdmin/PlatformAdminDashboard'

// Layout
import Layout from './components/Layout'

function redirectPathForUser(user) {
  if (!user?.tipo) return '/login'
  if (user.tipo === 'platform_admin') return '/platform-admin'
  if (user.tipo === 'admin') return '/admin'
  if (user.tipo === 'atencion') return '/mesero'
  if (user.tipo === 'cocina') return '/cocina'
  if (user.tipo === 'bar') return '/bar'
  if (user.tipo === 'proveedor') return '/proveedor'
  return `/${user.tipo}`
}

function HomeRedirect() {
  const { user, token } = useAuthStore()
  if (token && user) {
    return <Navigate to={redirectPathForUser(user)} replace />
  }
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <div className="min-h-screen pb-10">
        <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/platform-admin" element={
          <ProtectedRoute role="platform_admin">
            <Layout>
              <PlatformAdminDashboard />
            </Layout>
          </ProtectedRoute>
        } />
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
        <Route path="/admin/proveedores" element={
          <ProtectedRoute role="admin">
            <ProveedoresManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/mesas" element={
          <ProtectedRoute role="admin">
            <MesasManagement />
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
        
        <Route path="/" element={<HomeRedirect />} />
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

  const redirectForTipo = (tipo) => {
    if (tipo === 'platform_admin') return '/platform-admin'
    return `/${tipo}`
  }

  // platform_admin: acceso exclusivo a rutas platform_admin
  if (role === 'platform_admin' && user.tipo !== 'platform_admin') {
    return <Navigate to={redirectForTipo(user.tipo)} replace />
  }

  // Admin puede ver todo EXCEPTO platform_admin
  if (role && role !== 'platform_admin') {
    if (user.tipo !== role && user.tipo !== 'admin') {
      return <Navigate to={redirectForTipo(user.tipo)} replace />
    }
  }

  // Ya no redirigimos automáticamente al onboarding
  // El admin puede acceder manualmente desde el dashboard

  return children
}

export default App
