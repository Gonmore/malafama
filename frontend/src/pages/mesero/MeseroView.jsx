import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import { mesaService } from '../../services/mesaService';
import { comandaService } from '../../services/comandaService';
import { eventoService } from '../../services/eventoService';
import { asignacionService } from '../../services/asignacionService';
import { alertaService } from '../../services/alertaService';
import Navbar from '../../components/Navbar';
import EventoSelector from '../../components/EventoSelector';
import ComandaModal from './ComandaModal';
import MesaConComandaModal from './MesaConComandaModal';
import {
  AlertStack,
  OCCUPIED_SEAT_STATES,
  SegmentedTabs,
  SeatDots,
  STATUS_STYLE,
  formatAgo,
  sortMesasByOperationalPriority,
} from '../comandas/ComandasUI';

function shortName(name = '') {
  return String(name).split(' ').filter(Boolean)[0] || 'Mesero';
}

function isStaffMesa(mesa) {
  return Number(mesa?.numero) === 0;
}

function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/g, '');
}

function normalizeSeatStates(mesa, seatsByMesa = {}) {
  const byLetter = seatsByMesa?.[mesa?.numero] || {};
  if (Object.keys(byLetter).length === 0 && Array.isArray(mesa?.seatStates) && mesa.seatStates.length > 0) return mesa.seatStates;
  return ['A', 'B', 'C', 'D'].map((letra) => ({
    letra,
    estado: byLetter[letra]?.estado || byLetter[letra] || mesa?.seatStates?.find((seat) => seat.letra === letra)?.estado || 'disponible',
  }));
}

function getActiveComandas(mesa) {
  return Array.isArray(mesa?.comandas) ? mesa.comandas : [];
}

function deriveComandaStatus(comanda) {
  // Pagada solo cuando está cerrada o marcada explícitamente como pagada
  if (comanda?.estado === 'cerrada' || comanda?.estado === 'pagada' || comanda?.pagada || comanda?.paid) {
    return 'pagada';
  }

  // Entregado significa que ya salió de cocina/bar, pero aún no se cobró
  if (comanda?.entregado) return 'cuenta';

  const pedidos = Array.isArray(comanda?.pedidos) ? comanda.pedidos : [];
  const activePedidos = pedidos.filter((pedido) => pedido?.estado !== 'cancelado');
  if (activePedidos.length === 0) return 'preparando';

  const readyToDeliverCount = activePedidos.filter((pedido) => pedido?.estado === 'listo').length;
  const completedCount = activePedidos.filter((pedido) => ['listo', 'entregado'].includes(pedido?.estado)).length;

  if (readyToDeliverCount > 0 && completedCount === activePedidos.length) return 'listo';
  if (readyToDeliverCount > 0) return 'parcial';
  if (completedCount === activePedidos.length) return 'cuenta';
  return 'preparando';
}

function deriveMesaStatus(mesa) {
  const comandas = getActiveComandas(mesa);
  const seats = mesa?.seatStates || [];
  const staff = isStaffMesa(mesa);
  const hasOccupiedSeats = !staff && (mesa?.hasOccupiedSeats || seats.some((seat) => OCCUPIED_SEAT_STATES.has(seat.estado)));
  const allOccupied = !staff && (mesa?.allOccupied || (seats.length > 0 && seats.every((seat) => OCCUPIED_SEAT_STATES.has(seat.estado))));

  if (comandas.length === 0) return (hasOccupiedSeats || allOccupied) ? 'completa' : 'libre';

  const statuses = comandas.map(deriveComandaStatus);
  if (statuses.length > 0 && statuses.every((s) => s === 'pagada')) return 'pagada';
  if (statuses.includes('listo')) return 'listo';
  if (statuses.includes('parcial')) return 'parcial';
  if (statuses.includes('preparando')) return 'preparando';
  if (statuses.includes('cuenta')) return 'cuenta';
  return 'preparando';
}

function isMesaOperativamenteOcupada(mesa) {
  if (isStaffMesa(mesa)) return getActiveComandas(mesa).length > 0;
  return Boolean(mesa?.hasOccupiedSeats) || getActiveComandas(mesa).length > 0 || deriveMesaStatus(mesa) !== 'libre';
}

function formatComandaCountLabel(count) {
  if (count === 1) return '1 COMANDA ACTIVA';
  return `${count} COMANDAS ACTIVAS`;
}

function MeseroMesaCard({ mesa, status, assignee, onClick }) {
  const [expandido, setExpandido] = useState(false);
  const style = STATUS_STYLE[status] || STATUS_STYLE.libre;
  const comandas = getActiveComandas(mesa)
    .slice()
    .sort((a, b) => {
      const statusOrder = ['listo', 'parcial', 'preparando', 'cuenta', 'pagada'];
      const statusDiff = (statusOrder.indexOf(deriveComandaStatus(a)) ?? 99)
        - (statusOrder.indexOf(deriveComandaStatus(b)) ?? 99);
      if (statusDiff !== 0) return statusDiff;
      const createdA = new Date(a.createdAt || a.created_at || a.fecha || 0).getTime();
      const createdB = new Date(b.createdAt || b.created_at || b.fecha || 0).getTime();
      return createdA - createdB;
    });
  const comandasActivas = comandas.filter((c) => deriveComandaStatus(c) !== 'pagada');
  const comandasPagadas = comandas.filter((c) => deriveComandaStatus(c) === 'pagada');
  const visibleComandas = expandido ? comandasActivas : comandasActivas.slice(0, 3);
  const tieneVerMas = comandasActivas.length > 3;
  const isStaff = isStaffMesa(mesa);
  const displayAssignee = assignee || (isStaff ? 'Staff' : null);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[24px] border p-4 text-left transition active:scale-[0.98] flex flex-col items-start"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        boxShadow: `inset 0 0 0 1px ${style.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[34px] font-light leading-none text-white">{mesa?.numero}</div>
          <div className="mt-1 truncate text-sm font-medium text-slate-400">{displayAssignee || ''}</div>
        </div>
        <div className="pt-2">
          <SeatDots seats={mesa?.seatStates || []} status={status} />
        </div>
      </div>

      <div className="my-3 h-px w-full bg-slate-700/70" />

      {comandasActivas.length > 0 ? (
        <>
          <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">
            {formatComandaCountLabel(comandasActivas.length)}
          </div>
          <div className="space-y-2.5">
            {visibleComandas.map((comanda, idx) => {
              const comandaStatus = deriveComandaStatus(comanda);
              const comandaStyle = STATUS_STYLE[comandaStatus] || STATUS_STYLE.preparando;
              const pedidoCount = Array.isArray(comanda?.pedidos) ? comanda.pedidos.filter((pedido) => pedido?.estado !== 'cancelado').length : 0;
              return (
                <div key={comanda.id} className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-300">
                    <span className="mr-2 text-slate-300">#{idx + 1}</span>
                    <span className="text-slate-500">{pedidoCount} ped.</span>
                  </div>
                  <span
                    className="shrink-0 rounded-xl border px-3 py-1 text-xs font-bold"
                    style={{
                      color: comandaStyle.color,
                      borderColor: comandaStyle.border,
                      backgroundColor: `${comandaStyle.color}22`,
                    }}
                  >
                    {comandaStyle.label}
                  </span>
                </div>
              );
            })}
          </div>
          {tieneVerMas && (
            <div className="mt-2 text-left">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandido(!expandido);
                }}
                className="text-xs font-bold uppercase tracking-wide text-blue-400 hover:text-blue-300 transition"
              >
                {expandido ? '↑ Ver menos' : `↓ Ver ${comandasActivas.length - 3} más`}
              </button>
            </div>
          )}
          {comandasPagadas.length > 0 && (
            <>
              <div className="my-3 h-px w-full bg-slate-700/70" />
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-purple-400">
                {comandasPagadas.length} comanda{comandasPagadas.length === 1 ? '' : 's'} pagada{comandasPagadas.length === 1 ? '' : 's'}
              </div>
              <div className="space-y-2.5">
                {comandasPagadas.map((comanda, idx) => {
                  const comandaStyle = STATUS_STYLE.pagada;
                  const pedidoCount = Array.isArray(comanda?.pedidos) ? comanda.pedidos.filter((pedido) => pedido?.estado !== 'cancelado').length : 0;
                  return (
                    <div key={comanda.id} className="flex items-center gap-2.5">
                      <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-300">
                        <span className="mr-2 text-slate-300">#{comandasActivas.length + idx + 1}</span>
                        <span className="text-slate-500">{pedidoCount} ped.</span>
                      </div>
                      <span
                        className="shrink-0 rounded-xl border px-3 py-1 text-xs font-bold"
                        style={{
                          color: comandaStyle.color,
                          borderColor: comandaStyle.border,
                          backgroundColor: `${comandaStyle.color}22`,
                        }}
                      >
                        {comandaStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : comandasPagadas.length > 0 ? (
        <>
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-purple-400">
            {comandasPagadas.length} comanda{comandasPagadas.length === 1 ? '' : 's'} pagada{comandasPagadas.length === 1 ? '' : 's'}
          </div>
          <div className="space-y-2.5">
            {comandasPagadas.map((comanda, idx) => {
              const comandaStyle = STATUS_STYLE.pagada;
              const pedidoCount = Array.isArray(comanda?.pedidos) ? comanda.pedidos.filter((pedido) => pedido?.estado !== 'cancelado').length : 0;
              return (
                <div key={comanda.id} className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-300">
                    <span className="mr-2 text-slate-300">#{idx + 1}</span>
                    <span className="text-slate-500">{pedidoCount} ped.</span>
                  </div>
                  <span
                    className="shrink-0 rounded-xl border px-3 py-1 text-xs font-bold"
                    style={{
                      color: comandaStyle.color,
                      borderColor: comandaStyle.border,
                      backgroundColor: `${comandaStyle.color}22`,
                    }}
                  >
                    {comandaStyle.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-6 text-center text-[15px] font-medium text-slate-500">
          {isStaff ? 'Libre · Staff' : 'Sin comandas activas'}
        </div>
      )}
    </button>
  );
}

export default function MeseroView() {
  const { user } = useAuthStore();
  const { localActivo } = useLocalStore();
  const previewLocalId = (() => {
    try {
      return new URLSearchParams(window.location.search).get('localId');
    } catch (e) {
      return null;
    }
  })();
  const effectiveLocalId = previewLocalId || user?.localId || localActivo?.id || null;
  const [evento, setEvento] = useState(null);
  const [eventoRefreshKey, setEventoRefreshKey] = useState(0);
  const [allMesas, setAllMesas] = useState([]);
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [turnoMeseros, setTurnoMeseros] = useState([]);
  const [asignacionesByMesa, setAsignacionesByMesa] = useState(new Map());
  const [seatStateMap, setSeatStateMap] = useState({});
  const [alertas, setAlertas] = useState([]);
  const [tab, setTab] = useState('mis');
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [showMesaConComandaModal, setShowMesaConComandaModal] = useState(false);
  const [comandaIdSeleccionada, setComandaIdSeleccionada] = useState(null);
  const loadGenRef = useRef(0);
  const eventoRef = useRef(evento);
  const effectiveLocalIdRef = useRef(effectiveLocalId);
  eventoRef.current = evento;
  effectiveLocalIdRef.current = effectiveLocalId;

  const loadData = async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const selectedEvento = eventoRef.current;
      const currentLocalId = effectiveLocalIdRef.current;
      setSeatStateMap({});

      let mesas = [];
      let assigned = new Set();
      if (selectedEvento?.id) {
        const [mesasRes, misRes, turnoRes, asignRes] = await Promise.all([
          eventoService.getMesasConEstado(selectedEvento.id, currentLocalId ? { localId: currentLocalId } : {}).catch(() => null),
          asignacionService.getMisMesas(selectedEvento.id).catch(() => null),
          asignacionService.getTurno(selectedEvento.id).catch(() => null),
          asignacionService.getAsignaciones(selectedEvento.id).catch(() => null),
        ]);
        if (gen !== loadGenRef.current) return;
        mesas = mesasRes?.data || [];
        assigned = new Set((misRes?.data || []).map((m) => m.id));
        setTurnoMeseros(turnoRes?.data || []);
        const map = new Map();
        (asignRes?.data || []).forEach((row) => {
          if (row?.mesaId && row?.meseroId) map.set(row.mesaId, row.meseroId);
        });
        setAsignacionesByMesa(map);
      } else {
        setTurnoMeseros([]);
        setAsignacionesByMesa(new Map());
      }

      if (mesas.length === 0) {
        const mesasRes = await mesaService.getAll({
          activo: true,
          ...(currentLocalId ? { localId: currentLocalId } : {}),
        });
        if (gen !== loadGenRef.current) return;
        mesas = mesasRes?.data || [];
        if (!selectedEvento?.id) assigned = new Set(mesas.map((m) => m.id));
      }

      setAllMesas(mesas.map((mesa) => ({
        ...mesa,
        seatStates: normalizeSeatStates(mesa, {}),
      })));
      setAssignedIds(assigned);
      setTab(selectedEvento?.id || assigned.size > 0 ? 'mis' : 'todas');

      const alertRes = await alertaService.getActivas().catch(() => null);
      if (gen !== loadGenRef.current) return;
      setAlertas(alertRes?.data || []);
    } catch (error) {
      console.error('Error al cargar vista mesero:', error);
      toast.error('Error al cargar mesas');
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveLocalId, evento?.id]);

  useEffect(() => {
    const socket = io(resolveSocketUrl());
    socket.on('connect', () => {
      socket.emit('register', { userId: user?.id, userType: user?.tipo || 'atencion' });
      const localRoomId = effectiveLocalIdRef.current || user?.localId;
      socket.emit('join-room', localRoomId ? `atencion:${localRoomId}` : 'atencion');
    });

    socket.on('asiento:update', ({ mesaNum, letra, estado }) => {
      setSeatStateMap((prev) => ({
        ...prev,
        [mesaNum]: { ...(prev[mesaNum] || {}), [letra]: { estado } },
      }));
      setAllMesas((prev) => prev.map((mesa) => {
        if (Number(mesa.numero) !== Number(mesaNum)) return mesa;
        const current = Object.fromEntries((mesa.seatStates || []).map((seat) => [seat.letra, { estado: seat.estado }]));
        const seatStates = normalizeSeatStates(mesa, { [mesaNum]: { ...current, [letra]: { estado } } });
        return { ...mesa, seatStates };
      }));
    });

    socket.on('alerta:nueva', (alerta) => {
      setAlertas((prev) => (prev.some((a) => a.id === alerta.id) ? prev : [...prev, alerta]));
    });

    socket.on('alerta:resuelta', ({ id }) => {
      setAlertas((prev) => prev.filter((a) => a.id !== id));
    });

    socket.on('evento:sync', () => setEventoRefreshKey((k) => k + 1));
    socket.on('evento:deleted', () => setEventoRefreshKey((k) => k + 1));
    socket.on('asignacion:guardada', loadData);
    socket.on('asignacion:limpiada', loadData);
    socket.on('mesas:asignacion_guardada', loadData);
    socket.on('turno:update', loadData);
    socket.on('pedido-actualizado', loadData);
    socket.on('pedido-listo', loadData);
    socket.on('comanda-completa', loadData);
    socket.on('comanda-entregada', loadData);
    socket.on('comanda-actualizada', loadData);

    return () => socket.disconnect();
  }, [user?.id, user?.tipo, user?.localId, effectiveLocalId]);

  const enrichedMesas = useMemo(() => allMesas.map((mesa) => ({
    ...mesa,
    seatStates: normalizeSeatStates(mesa, seatStateMap),
    asignadoMeseroId: asignacionesByMesa.get(mesa.id) || null,
  })), [allMesas, seatStateMap, asignacionesByMesa]);

  const mesasMis = enrichedMesas.filter((mesa) => assignedIds.has(mesa.id));
  const mesasOcupadas = enrichedMesas.filter(isMesaOperativamenteOcupada);
  const mesasVisibles = tab === 'mis' ? mesasMis : mesasOcupadas;

  const mesasOrdenadas = useMemo(
    () => sortMesasByOperationalPriority(mesasVisibles, deriveMesaStatus),
    [mesasVisibles]
  );

  const alertasEnriquecidas = alertas.map((alerta) => {
    const mesa = alerta.mesa?.numero ? alerta.mesa : enrichedMesas.find((m) => m.id === alerta.mesaId);
    const comandaNumero = (() => {
      if (!alerta.comandaId || !mesa?.comandas || mesa.comandas.length === 0) return null;
      const ordered = [...mesa.comandas].sort((a, b) => {
        const createdA = new Date(a.createdAt || a.created_at || a.fecha || 0).getTime();
        const createdB = new Date(b.createdAt || b.created_at || b.fecha || 0).getTime();
        return createdA - createdB;
      });
      const idx = ordered.findIndex((c) => String(c.id) === String(alerta.comandaId));
      return idx >= 0 ? idx + 1 : null;
    })();

    return {
      ...alerta,
      mesa: mesa ? { id: mesa.id, numero: mesa.numero, nombre: mesa.nombre } : alerta.mesa,
      comandaNumero,
    };
  });

  const handleResolverAlerta = async (alerta) => {
    try {
      if (alerta.tipo === 'listo' && alerta.comandaId) {
        await comandaService.marcarEntregada(alerta.comandaId);
      }
      await alertaService.resolver(alerta.id);
      setAlertas((prev) => prev.filter((a) => a.id !== alerta.id));
      await loadData();
    } catch (error) {
      console.error('Error al resolver alerta:', error);
      toast.error('No se pudo actualizar la alerta');
    }
  };

  const handleMesaClick = async (mesa) => {
    try {
      const res = await mesaService.getById(mesa.id, evento?.id ? { eventoId: evento.id } : {});
      const mesaCompleta = {
        ...mesa,
        ...(res?.data || {}),
        seatStates: mesa.seatStates,
      };
      const comandas = getActiveComandas(mesaCompleta);
      setSelectedMesa(mesaCompleta);
      setComandaIdSeleccionada(null);
      if (comandas.length > 0) {
        setShowMesaConComandaModal(true);
      } else {
        setShowComandaModal(true);
      }
    } catch {
      toast.error('No se pudo abrir la mesa');
    }
  };

  const statusLegendOrder = ['preparando', 'parcial', 'listo', 'cuenta', 'pagada'];

  return (
    <div className="min-h-screen bg-gray-900 text-slate-100">
      <Navbar darkMode />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col pb-12">
        <EventoSelector selectedEvento={evento} onEventoChange={setEvento} refreshKey={eventoRefreshKey} />
        <AlertStack alertas={alertasEnriquecidas} onAction={handleResolverAlerta} />
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'mis', label: `Mis mesas (${mesasMis.length})` },
            { key: 'todas', label: `Ocupadas (${mesasOcupadas.length})` },
          ]}
        />

        <div className="border-b border-gray-700 bg-gray-800">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-3 px-4 py-4 text-xs font-semibold text-slate-400 sm:px-6 lg:px-8">
            {statusLegendOrder.map((key) => {
              const style = STATUS_STYLE[key];
              if (!style) return null;
              return (
              <span key={key} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
                {style.label}
              </span>
              );
            })}
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-8 pb-16 sm:px-6 lg:px-8">
          {loading ? (
            <div className="py-20 text-center text-slate-400">Cargando mesas...</div>
          ) : mesasVisibles.length === 0 ? (
            <div className="py-20 text-center text-slate-400">No hay mesas asignadas</div>
          ) : (
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))] md:[grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
              {mesasOrdenadas.map((mesa) => {
                const status = deriveMesaStatus(mesa);
                const assignee = turnoMeseros.find((turno) => turno.meseroId === mesa.asignadoMeseroId);
                const esStaff = isStaffMesa(mesa);
                return (
                  <MeseroMesaCard
                    key={mesa.id}
                    mesa={esStaff ? { ...mesa, numero: 'S' } : mesa}
                    status={status}
                    assignee={assignee ? shortName(assignee.nombre) : (tab === 'mis' ? shortName(user?.nombre) : null)}
                    onClick={() => handleMesaClick(mesa)}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>

      {showComandaModal && selectedMesa && (
        <ComandaModal
          mesa={selectedMesa}
          comandaId={comandaIdSeleccionada}
          eventoId={evento?.id || null}
          darkMode
          staffPricing={isStaffMesa(selectedMesa)}
          onClose={() => {
            setShowComandaModal(false);
            setSelectedMesa(null);
            setComandaIdSeleccionada(null);
            loadData();
          }}
        />
      )}

      {showMesaConComandaModal && selectedMesa && (
        <MesaConComandaModal
          mesa={selectedMesa}
          isMobile
          darkMode
          onContinuar={(comandaId) => {
            setComandaIdSeleccionada(comandaId);
            setShowMesaConComandaModal(false);
            setShowComandaModal(true);
          }}
          onCrearNueva={() => {
            setComandaIdSeleccionada(null);
            setShowMesaConComandaModal(false);
            setShowComandaModal(true);
          }}
          onGenerarCuenta={(comandaId) => {
            setComandaIdSeleccionada(comandaId || null);
            setShowMesaConComandaModal(false);
            setShowComandaModal(true);
          }}
          onClose={() => {
            setShowMesaConComandaModal(false);
            setSelectedMesa(null);
          }}
        />
      )}
    </div>
  );
}
