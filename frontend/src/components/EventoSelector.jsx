import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { eventoService } from '../services/eventoService';

function formatEvento(evento) {
  if (!evento) return 'Sin eventos activos';

  const fechaRaw = evento.fecha || evento.fechaEvento || evento.fecha_evento || evento.date || '';
  let fecha = '';
  if (fechaRaw) {
    const raw = String(fechaRaw);
    const plainDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (plainDateMatch) {
      fecha = `${plainDateMatch[3]}/${plainDateMatch[2]}/${plainDateMatch[1]}`;
    } else {
      const parsed = new Date(fechaRaw);
      fecha = Number.isNaN(parsed.getTime())
        ? raw
        : parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }

  const hora = evento.horaInicio || evento.hora_inicio || '';
  const nombre = evento.titulo || evento.nombre || 'Evento';
  return [nombre, fecha, hora].filter(Boolean).join(' - ');
}

export default function EventoSelector({ selectedEvento, onEventoChange, refreshKey = 0, accent = 'blue' }) {
  const { user } = useAuthStore();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const includePast = user?.tipo === 'admin';
  const isAdmin = user?.tipo === 'admin' || user?.tipo === 'platform_admin';
  const selectedEventoIdRef = useRef(selectedEvento?.id);
  selectedEventoIdRef.current = selectedEvento?.id;

  const accentClass = accent === 'orange' ? 'focus:ring-orange-500' : 'focus:ring-blue-500';

  const loadEventos = async (mounted = true) => {
    try {
      setLoading(true);
      const res = await eventoService.getEventos({ includePast });
      const lista = res?.data || [];
      if (!mounted) return;

      setEventos(lista);

      if (lista.length === 0) {
        onEventoChange?.(null);
        return;
      }

      const stillAvailable = selectedEventoIdRef.current && lista.some((evento) => evento.id === selectedEventoIdRef.current);
      if (!stillAvailable) onEventoChange?.(lista[0]);
    } catch (error) {
      if (!mounted) return;
      setEventos([]);
      onEventoChange?.(null);
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadEventos(mounted);
    const interval = setInterval(() => loadEventos(mounted), 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [includePast, refreshKey]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await eventoService.syncFirebase();
      await loadEventos();
    } catch (err) {
      console.error('Error al sincronizar Firebase:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleChange = (event) => {
    const next = eventos.find((evento) => String(evento.id) === event.target.value) || null;
    onEventoChange?.(next);
  };

  return (
    <div className="border-b border-gray-700 bg-gray-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Evento</label>
          {isAdmin && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || loading}
              className="text-xs font-semibold text-slate-400 hover:text-blue-400 transition disabled:opacity-40"
              title="Sincronizar eventos desde Firebase"
            >
              {syncing ? 'Sincronizando...' : '↻ Sync Firebase'}
            </button>
          )}
        </div>
        <div className="relative">
          <select
            value={selectedEvento?.id || ''}
            onChange={handleChange}
            disabled={loading || eventos.length === 0}
            className={`w-full appearance-none rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 pr-10 text-sm font-bold text-white outline-none transition-colors ${accentClass} disabled:cursor-default disabled:text-slate-400`}
          >
            {eventos.length === 0 ? (
              <option value="">{loading ? 'Cargando eventos...' : 'Sin eventos activos'}</option>
            ) : (
              eventos.map((evento) => (
                <option key={evento.id} value={evento.id}>
                  {formatEvento(evento)}
                </option>
              ))
            )}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white">v</span>
        </div>
        {eventos.length === 0 && !loading && (
          <p className="text-sm font-semibold text-slate-400">Sin eventos activos</p>
        )}
      </div>
    </div>
  );
}
