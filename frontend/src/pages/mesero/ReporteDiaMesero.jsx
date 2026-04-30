import { useState, useEffect } from 'react';
import { reporteService } from '../../services/reporteService';
import { toast } from 'react-hot-toast';

export default function ReporteDiaMesero({ onClose, darkMode = false }) {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarReporte = async () => {
    try {
      setLoading(true);
      const data = await reporteService.getReporteDiaMesero();
      setReporte(data);
    } catch (error) {
      console.error('Error al cargar reporte:', error);
      toast.error('Error al cargar el reporte del día');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReporte();
    
    // Auto-refresh cada 30 segundos
    const intervalo = setInterval(() => {
      cargarReporte();
    }, 30000);
    
    return () => clearInterval(intervalo);
  }, []);

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearMoneda = (monto) => {
    return `Bs ${parseFloat(monto).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-3xl p-8 shadow-2xl`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-slate-400'}`}>Cargando reporte...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-4xl max-h-[95vh] flex flex-col my-4`}>
        {/* Header */}
        <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-slate-700'} flex-shrink-0`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-slate-100'}`}>
              📊 Reporte del Día
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'hover:bg-gray-800 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Período: {formatearFecha(reporte.inicioDia)} - {formatearFecha(reporte.finDia)}
          </p>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Totales generales */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900/30' : 'bg-blue-900/20'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Total del Día</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-blue-200' : 'text-blue-600'}`}>
                {formatearMoneda(reporte.totales.totalDia)}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-green-900/30' : 'bg-green-900/20'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Efectivo</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-green-200' : 'text-green-600'}`}>
                {formatearMoneda(reporte.totales.totalEfectivo)}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-purple-900/30' : 'bg-purple-900/20'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>QR</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-purple-200' : 'text-purple-600'}`}>
                {formatearMoneda(reporte.totales.totalQr)}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-orange-900/30' : 'bg-orange-900/20'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>Cerradas</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-orange-200' : 'text-orange-600'}`}>
                {reporte.totales.comandasCerradas}
              </p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-yellow-900/30' : 'bg-yellow-900/20'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>Abiertas</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-yellow-200' : 'text-yellow-600'}`}>
                {reporte.totales.comandasAbiertas}
              </p>
            </div>

            {parseFloat(reporte.totales.totalMixto) > 0 && (
              <div className={`p-4 rounded-xl ${darkMode ? 'bg-pink-900/30' : 'bg-pink-50'}`}>
                <p className={`text-sm font-semibold ${darkMode ? 'text-pink-300' : 'text-pink-700'}`}>Mixto</p>
                <p className={`text-2xl font-bold ${darkMode ? 'text-pink-200' : 'text-pink-600'}`}>
                  {formatearMoneda(reporte.totales.totalMixto)}
                </p>
              </div>
            )}
          </div>

          {/* Por mesa */}
          {reporte.mesas.length === 0 ? (
            <div className={`text-center py-12 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <p className="text-lg">No hay comandas registradas en el día</p>
              <p className="text-sm mt-2">Las comandas aparecerán aquí cuando se generen</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reporte.mesas.map((mesa) => (
                <div
                  key={mesa.numero}
                  className={`p-5 rounded-xl border-2 ${
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-slate-100'}`}>
                      <img src="/mesa.png" className="inline w-5 h-5 object-contain mr-1" alt="mesa" /> Mesa {mesa.numero}
                    </h3>
                    <span className={`text-lg font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formatearMoneda(mesa.totalMesa)}
                    </span>
                  </div>

                  {/* Comandas de la mesa */}
                  <div className="space-y-3">
                    {mesa.comandas.map((comanda) => (
                      <div
                        key={comanda.id}
                        className={`p-4 rounded-lg ${
                          darkMode ? 'bg-gray-900' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-slate-300'}`}>
                              Comanda #{comanda.id.slice(0, 8)}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                              {formatearFecha(comanda.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {formatearMoneda(comanda.total)}
                            </p>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                comanda.estado === 'cerrada'
                                  ? darkMode
                                    ? 'bg-green-900/30 text-green-300'
                                    : 'bg-green-900/30 text-green-700'
                                  : darkMode
                                    ? 'bg-yellow-900/30 text-yellow-300'
                                    : 'bg-yellow-900/30 text-yellow-700'
                              }`}
                            >
                              {comanda.estado}
                            </span>
                          </div>
                        </div>

                        {/* Forma de pago */}
                        {comanda.formaPago && comanda.estado === 'cerrada' && (
                          <div className={`mb-3 p-3 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-slate-900'}`}>
                            <p className={`text-xs font-semibold mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              Forma de pago:
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {comanda.formaPago === 'efectivo' && (
                                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-900/30 text-green-700'}`}>
                                  💵 Efectivo: {formatearMoneda(comanda.total)}
                                </span>
                              )}
                              {comanda.formaPago === 'qr' && (
                                <>
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-900/30 text-purple-700'}`}>
                                    📱 QR: {formatearMoneda(comanda.total)}
                                  </span>
                                  {comanda.comprobante && (
                                    <a
                                      href={comanda.comprobante}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`px-3 py-1 rounded-full text-sm font-semibold underline ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                    >
                                      📄 Ver comprobante
                                    </a>
                                  )}
                                </>
                              )}
                              {comanda.formaPago === 'mixto' && (
                                <>
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${darkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-900/30 text-green-700'}`}>
                                    💵 Efectivo: {formatearMoneda(comanda.cantidadEfectivo)}
                                  </span>
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${darkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-900/30 text-purple-700'}`}>
                                    📱 QR: {formatearMoneda(comanda.cantidadQr)}
                                  </span>
                                  {comanda.comprobante && (
                                    <a
                                      href={comanda.comprobante}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`px-3 py-1 rounded-full text-sm font-semibold underline ${darkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                    >
                                      📄 Ver comprobante
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Pedidos */}
                        <div className="space-y-1">
                          {comanda.pedidos.map((pedido) => (
                            <div
                              key={pedido.id}
                              className={`flex items-center justify-between text-sm py-1 ${
                                darkMode ? 'text-gray-300' : 'text-slate-300'
                              }`}
                            >
                              <span>
                                {pedido.cantidad}x {pedido.producto?.nombre || 'Producto'}
                              </span>
                              <span className="font-semibold">
                                {formatearMoneda(pedido.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-slate-700 bg-white'} flex-shrink-0`}>
          <button
            onClick={onClose}
            className={`w-full px-6 py-3 rounded-xl font-bold transition-colors ${
              darkMode
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
