import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Detectar dark mode desde localStorage de cualquier vista
    const checkDarkMode = () => {
      const meseroDark = localStorage.getItem('mesero_dark_mode') === 'true';
      const barDark = localStorage.getItem('bar_dark_mode') === 'true';
      const cocinaDark = localStorage.getItem('cocina_dark_mode') === 'true';
      setDarkMode(meseroDark || barDark || cocinaDark);
    };

    checkDarkMode();
    
    // Revisar cada segundo por si cambia
    const interval = setInterval(checkDarkMode, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className={`fixed bottom-0 left-0 right-0 ${darkMode ? 'bg-gray-900/90' : 'bg-white/90'} border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} py-2 z-40`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2">
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Powered</span>
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[8px] font-semibold">
          by
        </div>
        <img
          src={darkMode ? "/SNT_logo/Logo_Blanco.png" : "/SNT_logo/Logo_Azul.png"}
          alt="SNT Logo"
          className="h-6 object-contain"
          onError={(e) => {
            console.error('Error loading logo');
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className={`text-sm hidden sm:inline ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Supernovatel</span>
      </div>
    </footer>
  );
}
