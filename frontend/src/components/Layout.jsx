import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/80 backdrop-blur-md shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight gradient-title">MalaFama</h1>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{user?.tipo}</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-slate-300">
                <User className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-semibold">{user?.nombre}</span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-red-600/20 bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white transition-all duration-300"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
