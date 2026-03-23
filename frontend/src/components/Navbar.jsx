import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import UserDropdown from './UserDropdown';

export default function Navbar({ roleLabel = null, pedidosCount = null, onReporteDia = null, darkMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const searchParams = new URLSearchParams(location.search);
  const isPreview = searchParams.get('preview') === '1';
  const previewLocalId = searchParams.get('localId');

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

  const handleBackToAdmin = () => {
    if (previewLocalId) {
      navigate(`/admin/local/${encodeURIComponent(previewLocalId)}`);
      return;
    }
    navigate('/admin');
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg sticky top-0 z-50">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between">
          {/* Logo como Home */}
          <button 
            onClick={handleHomeClick}
            className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
          >
            {user?.local?.logo ? (
              <div className="bg-white rounded-md p-1 shadow-sm" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                  src={user.local.logo} 
                  alt="Home"
                  className="h-6 w-6 object-contain"
                />
              </div>
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

          {/* Info Usuario y UserDropdown */}
          <div className="flex items-center gap-3">
            {isPreview && (
              <button
                onClick={handleBackToAdmin}
                className="px-3 py-2 rounded-lg border transition-colors bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                Volver al admin
              </button>
            )}

            {/* Mostrar botón Asignar Mesas visible en la barra para meseros */}
            {user?.tipo === 'atencion' && (
              <button
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('open-assign-modal')); } catch (e) {}
                  navigate('/mesero');
                }}
                className="px-3 py-2 rounded-lg border transition-colors bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hidden md:inline"
              >
                Asignar mesas
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-white font-semibold text-sm">{user?.nombre}</p>
              <p className="text-blue-100 text-xs capitalize">{user?.tipo}</p>
            </div>
            
            <UserDropdown 
              onReporteDia={onReporteDia || (() => {})} 
              darkMode={darkMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
