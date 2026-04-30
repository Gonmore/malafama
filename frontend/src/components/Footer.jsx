import React, { useState } from 'react';

export default function Footer() {
  const [logoError, setLogoError] = useState(false);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700 bg-slate-900/85 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-2">
        
        {/* Texto base */}
        <span className="text-xs sm:text-sm text-slate-400">
          Powered
        </span>

        {/* Badge "by" */}
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[8px] font-semibold">
          by
        </div>

        {/* Logo o fallback */}
        {!logoError ? (
          <img
            src="/SNT_logo/Logo_Blanco.png"
            alt="Supernovatel"
            className="h-5 sm:h-6 object-contain opacity-90 hover:opacity-100 transition"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
            Supernovatel
          </span>
        )}
      </div>
    </footer>
  );
}