import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const response = await authService.login(email, password)
      const { usuario, token } = response.data

      setAuth(usuario, token)
      toast.success('Inicio de sesión exitoso', { id: 'login-status' })

      // Redirigir según el tipo de usuario
      if (usuario.tipo === 'platform_admin') {
        navigate('/platform-admin')
      } else if (usuario.tipo === 'admin') {
        navigate('/admin')
      } else if (usuario.tipo === 'atencion') {
        navigate('/mesero')
      } else if (usuario.tipo === 'supervisor') {
        navigate('/supervisor')
      } else if (usuario.tipo === 'cocina') {
        // Determinar si es cocina o bar basado en el nombre/email
        const esBar = usuario.nombre?.toLowerCase().includes('bar') || 
                      usuario.email?.toLowerCase().includes('bar');
        navigate(esBar ? '/bar' : '/cocina')
      } else {
        navigate(`/${usuario.tipo}`)
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = status === 429
        ? 'Demasiados intentos o demasiado tráfico desde esta sesión. Intenta de nuevo en unos minutos.'
        : (error.response?.data?.message || 'Error al iniciar sesión');
      // Si vienen errores de validación, concatenarlos
      if (error.response?.data?.errors) {
        const details = error.response.data.errors.map(e => `${e.field}: ${e.message}`).join('\n');
        toast.error(`${msg}\n${details}`, { id: 'login-status' });
      } else {
        toast.error(msg, { id: 'login-status' });
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="ambient-blob bg-indigo-600 w-[20rem] h-[20rem] -top-28 -left-16" />
      <div className="ambient-blob bg-purple-600 w-[24rem] h-[24rem] top-12 -right-20" />

      <div className="glass-surface w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight gradient-title mb-2">MalaFama</h1>
          <p className="text-slate-400">Sistema de Gestion de Pedidos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="label-muted mb-2 block">
              Correo Electronico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="usuario@ejemplo.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label-muted mb-2 block">
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="********"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary"
          >
            {loading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Demo: admin@malafama.com / admin123</p>
        </div>
      </div>
    </div>
  )
}
