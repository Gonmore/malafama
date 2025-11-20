import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Navbar({ roleLabel = null, pedidosCount = null }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getHomeRoute = () => {
    switch (user?.tipo) {
      case 'admin':
        return '/admin';
      case 'atencion':
        return '/mesero';
      case 'cocina':
        return '/cocina';
      case 'bar':
        return '/bar';
      default:
        return '/';
    }
  };

  const handleHomeClick = () => {
    navigate(getHomeRoute());
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg sticky top-0 z-50">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between">
          {/* Logo como Home */}
          <button 
            onClick={handleHomeClick}
            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-lg hover:bg-white/30 transition-all"
          >
            {user?.local?.logo ? (
              <img 
                src={user.local.logo} 
                alt="Home"
                className="h-8 w-8 object-contain bg-white rounded p-0.5"
              />
            ) : (
              <span className="text-2xl">🏠</span>
            )}
            <span className="text-white font-semibold text-sm hidden sm:block">
              {user?.local?.nombre || 'Inicio'}
            </span>
          </button>
          
          {/* Centered role label and icon */}
          {roleLabel && (
            <div
              className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 pointer-events-none max-w-[60%]"
              aria-hidden={false}
            >
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-white font-semibold text-sm min-w-0">
                {/* Icon based on role */}
                {(() => {
                  const role = (roleLabel || '').toLowerCase();
                  if (role.includes('bar')) {
                    return (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 3h18M8 21h8M10 7v11M14 7v11" />
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 4v4l6 2 6-2V4" />
                      </svg>
                    );
                  }
                  if (role.includes('cocina')) {
                    return (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 3c0 3-5 4-5 8v3h10v-3c0-4-5-5-5-8z" />
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M9 16v4h6v-4" />
                      </svg>
                    );
                  }
                  return (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  );
                })()}

                <span className="select-none truncate">{roleLabel}</span>
                <span className="hidden sm:inline bg-white/20 text-white px-2 py-0.5 rounded-full text-xs">{pedidosCount ?? 0}</span>
              </div>
            </div>
          )}

          {/* Info Usuario y Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-white font-semibold text-sm">{user?.nombre}</p>
              <p className="text-blue-100 text-xs capitalize">{user?.tipo}</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-all font-semibold text-sm active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
