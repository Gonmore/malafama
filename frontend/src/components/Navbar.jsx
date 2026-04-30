import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import UserDropdown from './UserDropdown';

export default function Navbar({ roleLabel = null, pedidosCount = null, onReporteDia = null, darkMode = true }) {
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
      case 'supervisor':
        return '/supervisor';
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

  const localNombre = user?.local?.nombre || 'Local';
  const meseroNombre = user?.nombre || 'Mesero';

  return (
    <div className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/80 backdrop-blur-md shadow-lg">
      <div className="px-3 py-3">
        <div className="flex items-center justify-between">
          {/* Logo como Home */}
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-3 px-2 py-1 rounded-xl hover:bg-slate-800 transition-all"
          >
            {user?.local?.logo ? (
              <div className="bg-slate-800 rounded-md p-1 shadow-sm" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          {roleLabel && user?.tipo !== 'atencion' && (
            <div
              className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 pointer-events-none max-w-[60%]"
              aria-hidden={false}
            >
              <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1 rounded-full text-slate-100 border border-slate-700 font-semibold text-sm min-w-0">
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
                <span className="hidden sm:inline bg-indigo-600/30 text-indigo-200 px-2 py-0.5 rounded-full text-xs">{pedidosCount ?? 0}</span>
              </div>
            </div>
          )}

          {/* Info Usuario y UserDropdown */}
          <div className="flex items-center gap-3">
            {isPreview && (
              <button
                onClick={handleBackToAdmin}
                className="px-3 py-2 rounded-xl border transition-colors bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              >
                Volver al admin
              </button>
            )}

            <div className="text-right hidden sm:block">
              <p className="text-slate-100 font-semibold text-sm">{user?.tipo === 'atencion' ? localNombre : (user?.nombre || 'Usuario')}</p>
              <p className="text-slate-400 text-xs">{user?.tipo === 'atencion' ? meseroNombre : (user?.tipo || '')}</p>
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
