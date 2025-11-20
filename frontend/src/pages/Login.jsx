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
    setLoading(true)

    try {
      const response = await authService.login(email, password)
      const { usuario, token } = response.data

      setAuth(usuario, token)
      toast.success('Inicio de sesión exitoso')

      // Redirigir según el tipo de usuario
      if (usuario.tipo === 'admin') {
        navigate('/admin')
      } else if (usuario.tipo === 'atencion') {
        navigate('/mesero')
      } else if (usuario.tipo === 'cocina') {
        // Determinar si es cocina o bar basado en el nombre/email
        const esBar = usuario.nombre?.toLowerCase().includes('bar') || 
                      usuario.email?.toLowerCase().includes('bar');
        navigate(esBar ? '/bar' : '/cocina')
      } else {
        navigate(`/${usuario.tipo}`)
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al iniciar sesión';
      // Si vienen errores de validación, concatenarlos
      if (error.response?.data?.errors) {
        const details = error.response.data.errors.map(e => `${e.field}: ${e.message}`).join('\n');
        toast.error(`${msg}\n${details}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">MalaFama</h1>
          <p className="text-gray-600">Sistema de Gestión de Pedidos</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Correo Electrónico
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Demo: admin@malafama.com / password</p>
        </div>
      </div>
    </div>
  )
}
