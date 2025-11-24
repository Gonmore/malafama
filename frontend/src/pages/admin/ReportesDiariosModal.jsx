import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { reporteService } from '../../services/reporteService';
import localService from '../../services/localService';
import { toast } from 'react-hot-toast';

export default function ReportesDiariosModal({ onClose, darkMode = false }) {
  const { user } = useAuthStore();
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locales, setLocales] = useState([]);
  const [selectedLocalId, setSelectedLocalId] = useState(user?.local?.id || null);
  const [diasConReportes, setDiasConReportes] = useState([]);
  const computeBusinessDate = () => {
    const now = new Date();
    let base = new Date(now);
    base.setHours(6, 0, 0, 0);
    if (now.getHours() < 6) base.setDate(base.getDate() - 1);
    return base.toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(computeBusinessDate());
  const [viewingMonth, setViewingMonth] = useState(() => {
    // default to month of selectedDate
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(1);
    return d;
  });

  const cargar = async () => {
    try {
      setLoading(true);
      const data = await reporteService.getReportesDiariosLocal(selectedLocalId, selectedDate);
      setReporte(data);
    } catch (error) {
      console.error('Error al cargar reportes diarios admin:', error);
      const message = error?.response?.data?.message || 'No se pudo cargar los reportes del día';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // cargar lista de locales para admin (si aplica)
    const cargarLocales = async () => {
      try {
        const res = await localService.obtenerLocales();
        const list = res.data?.locales || res.data || [];
        setLocales(list);
        // si no hay selectedLocalId, intentar preseleccionar el primero
        if (!selectedLocalId && list.length > 0) setSelectedLocalId(list[0].id);
      } catch (err) {
        // no crítico
      }
    };

    cargarLocales();
  }, []);

  // cargar lista de días con reportes para el local seleccionado
  useEffect(() => {
    if (!selectedLocalId) return;
    const cargarDias = async () => {
      try {
        // obtener dias calculados (comandas) y dias almacenados
        const [resCalc, resStored] = await Promise.all([
          reporteService.getDiasConReportesLocal(selectedLocalId, 90),
          reporteService.getReporteDiarioStored(selectedLocalId)
        ]);

        // resCalc.days e resStored.reportes (array)
        const calcDays = (resCalc.days || []).map(d => ({ date: d.date, total: d.total }));
        const storedDays = (resStored.reportes || []).map(r => {
          // normalize fecha to YYYY-MM-DD string (Sequelize may return Date or string)
          const raw = r.fecha;
          const dateStr = typeof raw === 'string' ? raw : (raw ? new Date(raw).toISOString().split('T')[0] : null);
          return { date: dateStr, total: parseFloat(r.data?.totales?.totalDia || 0), stored: true };
        }).filter(x => x.date);

        // Merge: prefer storedDays totals when date matches
        const merged = {};
        calcDays.forEach(d => merged[d.date] = { date: d.date, total: d.total, stored: false });
        storedDays.forEach(d => merged[d.date] = { date: d.date, total: d.total, stored: true });

        setDiasConReportes(Object.values(merged).sort((a,b)=> b.date.localeCompare(a.date)));
        // set selectedDate to current business day when switching local
        setSelectedDate(computeBusinessDate());
      } catch (err) {
        console.error('Error cargando dias con reportes:', err);
      }
    };

    cargarDias();
  }, [selectedLocalId]);

  // Volver a cargar el reporte cuando cambie el local seleccionado
  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => cargar(), 30000);
    return () => clearInterval(intervalo);
  }, [selectedLocalId, selectedDate]);

  const fmtDate = (d) => new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtMoney = (n) => `Bs ${parseFloat(n || 0).toFixed(2)}`;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-3xl p-8 shadow-2xl`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className={`mt-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Cargando reportes...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reporte) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-5xl max-h-[95vh] flex flex-col my-4`}>
        <div className={`p-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between gap-4 flex-wrap`}> 
          {/* Local selector (si el admin tiene locales) */}
          <div className="flex items-center gap-3">
            {locales.length > 1 && (
              <select
                value={selectedLocalId || ''}
                onChange={(e) => setSelectedLocalId(e.target.value)}
                className="px-3 py-2 rounded-lg border"
              >
                {locales.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            )}
          <div>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>📥 Reportes diarios del local</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Período: {fmtDate(reporte.inicioDia)} - {fmtDate(reporte.finDia)}</p>
          </div>
          </div>
          <div>
            <button onClick={onClose} className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Selector de fechas - vista por mes (mostrar todos los días del mes) */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Seleccionar fecha</p>
              <div className="flex items-center gap-2">
                <button onClick={() => { const m = new Date(viewingMonth); m.setMonth(m.getMonth()-1); setViewingMonth(m); }} className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700 border'}`}>◀</button>
                <div className={`px-3 py-1 rounded font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{viewingMonth.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}</div>
                <button onClick={() => { const m = new Date(viewingMonth); m.setMonth(m.getMonth()+1); setViewingMonth(m); }} className={`px-2 py-1 rounded ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-700 border'}`}>▶</button>
              </div>
            </div>
            {/* Legend for markers */}
            <div className="flex items-center gap-4 mb-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">📌</div>
                <div className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Reporte persistido</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-yellow-400 text-white flex items-center justify-center">📝</div>
                <div className={`${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Actividad calculada</div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {/* Weekday headers (Lun..Dom) */}
              <div className="text-xs text-center font-semibold p-1">Lun</div>
              <div className="text-xs text-center font-semibold p-1">Mar</div>
              <div className="text-xs text-center font-semibold p-1">Mié</div>
              <div className="text-xs text-center font-semibold p-1">Jue</div>
              <div className="text-xs text-center font-semibold p-1">Vie</div>
              <div className="text-xs text-center font-semibold p-1">Sáb</div>
              <div className="text-xs text-center font-semibold p-1">Dom</div>
              {(() => {
                // month calendar view
                const first = new Date(viewingMonth);
                const year = first.getFullYear();
                const month = first.getMonth();

                // Day of week index (JS: Sun=0..Sat=6) -> we show Mon..Sun so compute offset
                const firstDayIndex = new Date(year, month, 1).getDay();
                const offset = (firstDayIndex + 6) % 7; // Monday-based

                const daysInMonth = new Date(year, month+1, 0).getDate();
                const cells = [];
                for (let i = 0; i < offset; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
                while (cells.length % 7 !== 0) cells.push(null);

                return cells.map((dt, idx) => {
                  if (!dt) return <div key={idx} className="p-2" />;
                  const iso = dt.toISOString().split('T')[0];
                  const active = iso === selectedDate;
                  const hasReportObj = diasConReportes.find(dd => dd.date === iso);
                  const isStored = hasReportObj?.stored === true;
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedDate(iso)}
                      className={`p-2 rounded-lg text-center transition ${active ? 'bg-blue-600 text-white' : darkMode ? 'bg-gray-800 text-gray-200 border border-gray-700' : 'bg-white text-gray-700 border border-gray-200'}`}
                      title={hasReportObj ? `${hasReportObj.total} comandas` : ''}
                    >
                      <div className="text-sm font-semibold">{dt.getDate()}</div>
                      <div className="text-xs mt-1">
                        {hasReportObj ? (
                          isStored ? (
                            <span className={`${active ? 'text-white' : ''}`} aria-label="Reporte persistido" title="Reporte persistido">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-xs">📌</span>
                            </span>
                          ) : (
                            <span className={`${active ? 'text-white' : ''}`} aria-label="Actividad calculada" title="Actividad calculada">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-xs">📝</span>
                            </span>
                          )
                        ) : <span className="text-transparent">.</span>}
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          {/* Totales generales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Total del Día</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-blue-200' : 'text-blue-600'}`}>{fmtMoney(reporte.totales.totalDia)}</p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-green-300' : 'text-green-700'}`}>Efectivo</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-green-200' : 'text-green-600'}`}>{fmtMoney(reporte.totales.totalEfectivo)}</p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-700'}`}>QR</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-purple-200' : 'text-purple-600'}`}>{fmtMoney(reporte.totales.totalQr)}</p>
            </div>

            <div className={`p-4 rounded-xl ${darkMode ? 'bg-orange-900/30' : 'bg-orange-50'}`}>
              <p className={`text-sm font-semibold ${darkMode ? 'text-orange-300' : 'text-orange-700'}`}>Mixto</p>
              <p className={`text-2xl font-bold ${darkMode ? 'text-orange-200' : 'text-orange-600'}`}>{fmtMoney(reporte.totales.totalMixto)}</p>
            </div>
          </div>

          {/* Por usuario */}
          {reporte.usuarios.length === 0 ? (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <p>No hay reportes enviados por los usuarios del local en este período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reporte.usuarios.map(usuario => (
                <div key={usuario.id} className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{usuario.nombre} <span className={`text-xs ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>({usuario.tipo})</span></p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{usuario.comandas.length} comandas</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>{fmtMoney(usuario.totalUsuario)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {usuario.comandas.map(c => (
                      <div key={c.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Comanda #{c.id.slice(0,8)} • Mesa {c.mesa?.numero ?? '—'}
                            </p>
                            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{fmtDate(c.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${darkMode ? 'text-blue-200' : 'text-blue-600'}`}>{fmtMoney(c.total)}</p>
                            {c.formaPago && (
                              <div className="mt-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full ${darkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>{c.estado}</span>
                                {c.formaPago === 'qr' && c.comprobante && (
                                  <a href={c.comprobante} target="_blank" rel="noreferrer" className={`ml-2 underline ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>Ver comprobante</a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Pedidos resumen */}
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {c.pedidos.slice(0,4).map(p => (
                            <div key={p.id} className={`p-2 rounded ${darkMode ? 'bg-gray-800/60' : 'bg-white'}`}>
                              <div className="flex items-center justify-between">
                                <span className={`${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{p.producto?.nombre ?? '—'}</span>
                                <span className={`font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>{parseFloat(p.subtotal).toFixed(2)}</span>
                              </div>
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
      </div>
    </div>
  );
}
