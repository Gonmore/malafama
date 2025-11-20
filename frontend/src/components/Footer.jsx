import React from 'react';

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white/90 border-t border-gray-200 py-2 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center gap-2">
        <span className="text-sm text-gray-600">Powered</span>
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[8px] font-semibold">
          by
        </div>
        <img
          src="/SNT_logo/Logo_Azul.png"
          alt="SNT Logo"
          className="h-6 object-contain"
          onError={(e) => {
            console.error('Error loading logo');
            e.currentTarget.style.display = 'none';
          }}
        />
        <span className="text-sm text-gray-400 hidden sm:inline">Supernovatel</span>
      </div>
    </footer>
  );
}
