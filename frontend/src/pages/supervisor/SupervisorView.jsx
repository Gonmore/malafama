import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import io from 'socket.io-client';
import { Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import { eventoService } from '../../services/eventoService';
import { asignacionService } from '../../services/asignacionService';
import { mesaService } from '../../services/mesaService';
import userService from '../../services/userService';
import Navbar from '../../components/Navbar';
import EventoSelector from '../../components/EventoSelector';
import ComandaModal from '../mesero/ComandaModal';
import MesaConComandaModal from '../mesero/MesaConComandaModal';
import {
  AddCircle,
  OCCUPIED_SEAT_STATES,
  SegmentedTabs,
  sortMesasByOperationalPriority,
  TableCard,
  getInitials,
  STATUS_STYLE,
  formatAgo,
} from '../comandas/ComandasUI';

const WAITER_COLORS = ['#ff3469', '#1f6db3', '#0d7b5d', '#d4537e', '#378add', '#ffcb34'];

function resolveSocketUrl() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) return window.location.origin;
  if (apiUrl.startsWith('/')) return window.location.origin;
  return apiUrl.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/g, '');
}

function colorForId(id = '') {
  let hash = 0;
  for (let i = 0; i < String(id).length; i += 1) hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
  return WAITER_COLORS[Math.abs(hash) % WAITER_COLORS.length];
}

function shortName(name = '') {
  return String(name).split(' ').filter(Boolean)[0] || 'Mesero';
}

function isStaffMesa(mesa) {
  return Number(mesa?.numero) === 0;
}

function mesaStatus(mesa) {
  const comandas = Array.isArray(mesa?.comandas) ? mesa.comandas : [];
  const seats = mesa?.seatStates || [];
  const staff = isStaffMesa(mesa);
  const hasOccupiedSeats = !staff && (mesa?.hasOccupiedSeats || seats.some((seat) => OCCUPIED_SEAT_STATES.has(seat.estado)));
  const allOccupied = !staff && (mesa?.allOccupied || (seats.length > 0 && seats.every((seat) => OCCUPIED_SEAT_STATES.has(seat.estado))));
  if (comandas.length === 0) return (hasOccupiedSeats || allOccupied) ? 'completa' : 'libre';
  if (comandas.some((c) => c.estado === 'cerrada')) return 'cuenta';
  const pedidos = comandas.flatMap((c) => c.pedidos || []);
  const ready = pedidos.filter((p) => ['listo', 'entregado'].includes(p.estado)).length;
  if (pedidos.length > 0 && ready === pedidos.length) return 'listo';
  if (ready > 0) return 'parcial';
  return 'preparando';
}

function isMesaOperativa(mesa) {
  if (isStaffMesa(mesa)) return true;
  return Boolean(mesa?.hasOccupiedSeats) || (Array.isArray(mesa?.comandas) && mesa.comandas.length > 0) || mesaStatus(mesa) !== 'libre';
}

function getMesaSubtext(mesa, status) {
  if (status === 'completa') return 'Sin pedido aún';
  if (status === 'libre') return '';
  const comandas = Array.isArray(mesa?.comandas) ? mesa.comandas : [];
  const first = comandas[0];
  if (status === 'parcial') return 'Bebida lista · falta cocina';
  if (first?.fecha || first?.createdAt || first?.created_at) {
    return formatAgo(first.fecha || first.createdAt || first.created_at);
  }
  return STATUS_STYLE[status]?.label || '';
}

function formatEventoLine(evento) {
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

function WaiterChip({ waiter, count, selected, onClick, muted = false }) {
  const color = waiter?.meseroId ? colorForId(waiter.meseroId) : '#64748b';
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-2">
      <span
        className={`flex h-[58px] w-[58px] items-center justify-center rounded-full text-lg font-bold ${selected ? 'ring-4 ring-white' : ''}`}
        style={{ backgroundColor: waiter?.meseroId ? color : 'transparent', border: waiter?.meseroId ? 'none' : '4px solid #64748b', color: muted ? '#94a3b8' : '#fff' }}
      >
        {waiter?.meseroId ? getInitials(waiter.nombre) : <Users className="h-7 w-7" />}
      </span>
      <span className={`max-w-full truncate text-xs font-bold ${selected ? 'text-white' : 'text-slate-400'}`}>
        {waiter?.meseroId ? shortName(waiter.nombre) : 'Todos'}
      </span>
      <span
        className="rounded-lg px-2 py-0.5 text-xs font-bold"
        style={{ backgroundColor: waiter?.meseroId ? `${color}33` : '#1e293b', color }}
      >
        {waiter?.meseroId ? `${count} mesas` : 'ver todo'}
      </span>
    </button>
  );
}

export default function SupervisorView() {
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
  const includePast = user?.tipo === 'admin';
  const [eventos, setEventos] = useState([]);
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [showEventoPicker, setShowEventoPicker] = useState(false);
  const [turnos, setTurnos] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [asignaciones, setAsignaciones] = useState(new Map());
  const [assignedIds, setAssignedIds] = useState(new Set());
  const [selectedMeseroId, setSelectedMeseroId] = useState(null);
  const [tab, setTab] = useState('sala');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddMesero, setShowAddMesero] = useState(false);
  const [allMeseros, setAllMeseros] = useState([]);

  // Mesero mode state
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [showMesaConComandaModal, setShowMesaConComandaModal] = useState(false);
  const [comandaIdSeleccionada, setComandaIdSeleccionada] = useState(null);

  const isAssignmentTab = tab === 'sala' || tab === 'sin';
  const loadGenRef = useRef(0);
  const selectedEventoRef = useRef(selectedEvento);
  selectedEventoRef.current = selectedEvento; // Siempre actual, leído en handlers

  const loadEventos = async () => {
    const res = await eventoService.getEventos({ includePast });
    const lista = res?.data || [];
    setEventos(lista);
    setSelectedEvento((current) => current || lista[0] || null);
  };

  const loadEventoData = async (eventoId = selectedEventoRef.current?.id) => {
    const gen = ++loadGenRef.current;

    if (!eventoId) {
      try {
        setLoading(true);
        const mesasRes = await mesaService.getAll({ activo: true });
        if (gen !== loadGenRef.current) return;
        const lista = mesasRes?.data || [];
        setTurnos([]);
        setMesas(lista);
        setAsignaciones(new Map());
        setAssignedIds(new Set(lista.map((m) => m.id)));
      } catch (error) {
        if (gen !== loadGenRef.current) return;
        console.error('Error al cargar sala sin evento:', error);
        toast.error('Error al cargar sala');
      }
      if (gen === loadGenRef.current) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [turnoRes, mesasRes, asignRes, misRes] = await Promise.all([
        asignacionService.getTurno(eventoId),
        eventoService.getMesasConEstado(eventoId, effectiveLocalId ? { localId: effectiveLocalId } : {}),
        asignacionService.getAsignaciones(eventoId),
        asignacionService.getMisMesas(eventoId).catch(() => null),
      ]);
      if (gen !== loadGenRef.current) return;
      setTurnos(turnoRes?.data || []);
      setMesas(mesasRes?.data || []);
      const map = new Map();
      (asignRes?.data || []).forEach((item) => {
        if (item.mesaId && item.meseroId) map.set(item.mesaId, item.meseroId);
      });
      setAsignaciones(map);
      setAssignedIds(new Set((misRes?.data || []).map((m) => m.id)));
    } catch (error) {
      if (gen !== loadGenRef.current) return;
      console.error('Error al cargar asignación:', error);
      toast.error('Error al cargar asignación');
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadEventos().catch(() => toast.error('Error al cargar eventos'));
  }, [includePast]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadEventos().catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [includePast]);

  useEffect(() => {
    loadEventoData(selectedEvento?.id);
  }, [selectedEvento?.id, effectiveLocalId]);

  useEffect(() => {
    const socket = io(resolveSocketUrl());
    socket.on('connect', () => {
      socket.emit('register', { userId: user?.id, userType: 'supervisor' });
      socket.emit('join-room', 'supervisor');
    });
    socket.on('asiento:update', () => loadEventoData(selectedEventoRef.current?.id));
    socket.on('evento:sync', () => { loadEventos().catch(() => {}); });
    socket.on('asignacion:guardada', ({ eventoId: evId }) => {
      const cur = selectedEventoRef.current?.id;
      if (!evId || evId === cur) loadEventoData(cur);
    });
    socket.on('turno:update', ({ eventoId: evId }) => {
      const cur = selectedEventoRef.current?.id;
      if (!evId || evId === cur) loadEventoData(cur);
    });
    socket.on('pedido-listo', () => loadEventoData(selectedEventoRef.current?.id));
    socket.on('comanda-actualizada', () => loadEventoData(selectedEventoRef.current?.id));
    return () => socket.disconnect();
  }, [user?.id]);

  const enrichedMesas = useMemo(() => mesas.map((mesa) => ({
    ...mesa,
    asignadoMeseroId: asignaciones.get(mesa.id) || null,
  })), [mesas, asignaciones]);

  const mesasOcupadas = useMemo(
    () => enrichedMesas.filter(isMesaOperativa),
    [enrichedMesas]
  );

  const displayedMesas = useMemo(() => {
    if (tab === 'sin') return mesasOcupadas.filter((mesa) => !mesa.asignadoMeseroId);
    if (tab === 'mis') return mesasOcupadas.filter((mesa) => isStaffMesa(mesa) || assignedIds.has(mesa.id));
    return mesasOcupadas; // sala
  }, [tab, mesasOcupadas, assignedIds]);

  const orderedMesas = useMemo(
    () => sortMesasByOperationalPriority(displayedMesas, mesaStatus),
    [displayedMesas]
  );

  const selectedMesero = turnos.find((turno) => turno.meseroId === selectedMeseroId);
  const selectedCount = selectedMeseroId
    ? [...asignaciones.values()].filter((id) => id === selectedMeseroId).length
    : asignaciones.size;

  const handleMesaTap = (mesa) => {
    if (!selectedMeseroId) return;
    setAsignaciones((prev) => {
      const next = new Map(prev);
      if (next.get(mesa.id) === selectedMeseroId) next.delete(mesa.id);
      else next.set(mesa.id, selectedMeseroId);
      return next;
    });
  };

  const handleMesaClick = async (mesa) => {
    try {
      const res = await mesaService.getById(mesa.id, selectedEvento?.id ? { eventoId: selectedEvento.id } : {});
      const mesaCompleta = {
        ...mesa,
        ...(res?.data || {}),
        seatStates: mesa.seatStates,
      };
      const comandas = Array.isArray(mesaCompleta?.comandas) ? mesaCompleta.comandas : [];
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

  const handleTableClick = (mesa) => {
    if (isAssignmentTab) handleMesaTap(mesa);
    else handleMesaClick(mesa);
  };

  const handleLimpiar = () => {
    if (!selectedMeseroId) return;
    setAsignaciones((prev) => {
      const next = new Map(prev);
      for (const [mesaId, meseroId] of next.entries()) {
        if (meseroId === selectedMeseroId) next.delete(mesaId);
      }
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!selectedEvento?.id) return;
    setSaving(true);
    try {
      const rows = [...asignaciones.entries()].map(([mesaId, meseroId]) => ({ mesaId, meseroId }));
      await asignacionService.guardar(selectedEvento.id, rows);
      toast.success('Asignaciones guardadas');
      await loadEventoData(selectedEvento.id);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const openAddMesero = async () => {
    try {
      const [resAtencion, resSupervisor] = await Promise.all([
        userService.getByTipo('atencion'),
        userService.getByTipo('supervisor'),
      ]);
      const atencion = Array.isArray(resAtencion) ? resAtencion : (resAtencion?.data || []);
      const supervisores = Array.isArray(resSupervisor) ? resSupervisor : (resSupervisor?.data || []);
      const lista = [...atencion, ...supervisores];
      const inTurn = new Set(turnos.map((turno) => turno.meseroId));
      setAllMeseros(lista.filter((u) => !inTurn.has(u.id)));
      setShowAddMesero(true);
    } catch {
      toast.error('Error al cargar meseros');
    }
  };

  const handleAddMesero = async (mesero) => {
    if (!selectedEvento?.id) return;
    try {
      await asignacionService.agregarMesero(selectedEvento.id, mesero.id);
      setShowAddMesero(false);
      await loadEventoData(selectedEvento.id);
    } catch {
      toast.error('Error al agregar mesero');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-slate-100">
      <Navbar roleLabel="Supervisor" pedidosCount={selectedCount} darkMode />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col pb-12">
        <EventoSelector selectedEvento={selectedEvento} onEventoChange={setSelectedEvento} />
        <section className="border-b border-gray-700 bg-gray-800">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="mb-4 min-w-0">
              <h1 className="truncate text-lg font-bold text-white">
                {isAssignmentTab ? 'Supervisor · asignación' : (user?.nombre || 'Supervisor')}
              </h1>
              <p className="truncate text-sm font-semibold text-slate-400">
                {formatEventoLine(selectedEvento)}
              </p>
            </div>
          </div>
        </section>

        {/* Waiter chip row — only in assignment tabs */}
        {isAssignmentTab && (
          <section className="border-b border-gray-700 bg-gray-800">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Equipo en turno</h2>
              <div className="flex gap-4 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
                <WaiterChip
                  waiter={null}
                  count={asignaciones.size}
                  selected={!selectedMeseroId}
                  muted
                  onClick={() => setSelectedMeseroId(null)}
                />
                {turnos.map((turno) => {
                  const count = [...asignaciones.values()].filter((id) => id === turno.meseroId).length;
                  return (
                    <WaiterChip
                      key={turno.meseroId}
                      waiter={turno}
                      count={count}
                      selected={selectedMeseroId === turno.meseroId}
                      onClick={() => setSelectedMeseroId(turno.meseroId)}
                    />
                  );
                })}
                <AddCircle onClick={openAddMesero} />
              </div>
            </div>
          </section>
        )}

        {isAssignmentTab && selectedMeseroId && (
          <div className="border-b border-blue-900/60 bg-blue-950/30 px-4 py-4 text-base font-medium text-blue-200 sm:px-6 lg:px-8">
            <span className="mr-3 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
            {shortName(selectedMesero?.nombre)} seleccionado · toca las mesas para asignar
          </div>
        )}

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'sala', label: `Sala (${mesasOcupadas.length})` },
            { key: 'sin', label: `Sin asignar (${mesasOcupadas.filter((mesa) => !mesa.asignadoMeseroId).length})` },
            { key: 'mis', label: `Mis mesas (${mesasOcupadas.filter((mesa) => isStaffMesa(mesa) || assignedIds.has(mesa.id)).length})` },
          ]}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-4 py-8 pb-16 sm:px-6 lg:px-8">
          {loading ? (
            <div className="py-20 text-center text-slate-400">Cargando sala...</div>
          ) : displayedMesas.length === 0 ? (
            <div className="py-20 text-center text-slate-400">No hay mesas para mostrar</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {orderedMesas.map((mesa) => {
                const assignee = turnos.find((turno) => turno.meseroId === mesa.asignadoMeseroId);
                const color = mesa.asignadoMeseroId ? colorForId(mesa.asignadoMeseroId) : '#475569';
                const isSelected = mesa.asignadoMeseroId && mesa.asignadoMeseroId === selectedMeseroId;
                const esStaff = isStaffMesa(mesa);
                const status = mesaStatus(mesa);

                if (isAssignmentTab) {
                  return (
                    <TableCard
                      key={mesa.id}
                      mesa={esStaff ? { ...mesa, numero: 'S' } : mesa}
                      status={status}
                      subtext={esStaff ? 'Staff' : (mesa.asignadoMeseroId ? 'Asignada' : 'Sin asignar')}
                      assignee={assignee ? shortName(assignee.nombre) : null}
                      assigneeColor={esStaff ? '#f59e0b' : color}
                      selectedOutline={Boolean(isSelected)}
                      muted={!mesa.asignadoMeseroId && tab === 'sala'}
                      onClick={() => handleTableClick(mesa)}
                    />
                  );
                }

                return (
                  <TableCard
                    key={mesa.id}
                    mesa={esStaff ? { ...mesa, numero: 'S' } : mesa}
                    status={status}
                    subtext={esStaff ? 'Staff · precio costo' : getMesaSubtext(mesa, status)}
                    assignee={tab === 'todas' && assignee ? shortName(assignee.nombre) : null}
                    assigneeColor={esStaff ? '#f59e0b' : undefined}
                    onClick={() => handleTableClick(mesa)}
                  />
                );
              })}
            </div>
          )}
        </main>

        {/* Bottom bar — only in assignment tabs */}
        {isAssignmentTab && (
          <div className="sticky bottom-10 z-30 border-t border-gray-700 bg-gray-800">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="min-w-0 flex-1 text-sm font-bold">
                <span className="text-white">{selectedMeseroId ? shortName(selectedMesero?.nombre) : 'Sala'}</span>
                <span className="text-slate-400"> · {selectedCount} mesas asignadas</span>
              </div>
              {selectedMeseroId && (
                <button type="button" onClick={handleLimpiar} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300">
                  Limpiar
                </button>
              )}
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving || !selectedEvento?.id}
                className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showEventoPicker && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={() => setShowEventoPicker(false)}>
          <div className="w-full max-w-2xl rounded-t-3xl border border-slate-700 bg-slate-900 p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">Seleccionar evento</h3>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {eventos.map((evento) => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => {
                    setSelectedEvento(evento);
                    setShowEventoPicker(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left ${selectedEvento?.id === evento.id ? 'bg-blue-600' : 'bg-slate-800'}`}
                >
                  <div className="font-bold text-white">{evento.titulo}</div>
                  <div className="text-sm font-semibold text-slate-400">{evento.fecha} · {evento.horaInicio || 'Sin hora'}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddMesero && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70" onClick={() => setShowAddMesero(false)}>
          <div className="w-full max-w-2xl rounded-t-3xl border border-slate-700 bg-slate-900 p-6" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">Agregar al turno</h3>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {allMeseros.length === 0 ? (
                <p className="py-8 text-center text-slate-400">Todos ya están en turno</p>
              ) : allMeseros.map((mesero) => (
                <button
                  key={mesero.id}
                  type="button"
                  onClick={() => handleAddMesero(mesero)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-800 px-4 py-3 text-left"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-white" style={{ backgroundColor: colorForId(mesero.id) }}>
                    {getInitials(mesero.nombre)}
                  </span>
                  <span>
                    <span className="block font-bold text-white">{mesero.nombre}</span>
                    <span className="block text-sm text-slate-400 capitalize">{mesero.tipo === 'supervisor' ? 'Supervisor' : 'Mesero'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showComandaModal && selectedMesa && (
        <ComandaModal
          mesa={selectedMesa}
          comandaId={comandaIdSeleccionada}
          eventoId={selectedEvento?.id || null}
          darkMode
          staffPricing={isStaffMesa(selectedMesa)}
          onClose={() => {
            setShowComandaModal(false);
            setSelectedMesa(null);
            setComandaIdSeleccionada(null);
            loadEventoData(selectedEvento?.id);
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
          onClose={() => {
            setShowMesaConComandaModal(false);
            setSelectedMesa(null);
          }}
        />
      )}
    </div>
  );
}
