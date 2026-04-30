import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocalStore } from '../../store/localStore';
import { useAuthStore } from '../../store/authStore';
import { comandaService } from '../../services/comandaService';
import { mesaService } from '../../services/mesaService';
import { reporteService } from '../../services/reporteService';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function MesasManagement() {
  const [loading, setLoading] = useState(true);
  const [mesas, setMesas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [movementMesa, setMovementMesa] = useState(null);
  const [movementSummary, setMovementSummary] = useState(null);
  const [movementComandas, setMovementComandas] = useState([]);
  const [ventasPorMesa, setVentasPorMesa] = useState(null);
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadMesas();
    loadVentasPorMesa();
  }, []);

  const loadMesas = async () => {
    setLoading(true);
    try {
      const response = await mesaService.getAll();
      setMesas(response.data?.mesas || response.data || []);
    } catch (error) {
      console.error('Error cargando mesas:', error);
      toast.error('No se pudo cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  const loadVentasPorMesa = async (start = fechaInicio, end = fechaFin) => {
    try {
      const res = await reporteService.getVentasMesa({ fechaInicio: start, fechaFin: end });
      setVentasPorMesa(res.data || res);
    } catch (error) {
      console.error('Error cargando ventas por mesa:', error);
      toast.error('No se pudo cargar el resumen de mesas');
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar esta mesa? Esta acción no se puede deshacer.')) return;
    try {
      await mesaService.delete(id);
      toast.success('Mesa eliminada');
      await loadMesas();
    } catch (error) {
      console.error('Error eliminando mesa:', error);
      toast.error('No se pudo eliminar la mesa');
    }
  };

  const handleAumentar = async (mesa) => {
    try {
      const nuevaCap = (mesa.capacidad || 1) + 1;
      await mesaService.update(mesa.id, { capacidad: nuevaCap });
      toast.success('Capacidad incrementada');
      await loadMesas();
    } catch (error) {
      console.error('Error actualizando mesa:', error);
      toast.error('No se pudo actualizar la mesa');
    }
  };

  const navigate = useNavigate();
  const { localActivo } = useLocalStore();
  const { user } = useAuthStore();
  const effectiveLocalId = localActivo?.id || user?.localId || user?.local?.id || null;
  const moneda = localActivo?.moneda || user?.local?.moneda || 'Bs';

  if (loading) return <LoadingSpinner text="Cargando mesas..." />;

  const topMesa = ventasPorMesa?.ventas?.[0] || null;

  

  return (
    <div>
      {/* Header: back button always left, optimized title, add button right */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(effectiveLocalId ? `/admin/local/${effectiveLocalId}` : '/admin')}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
            title="Volver al local"
            aria-label="Volver al local"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <h2 className="text-xl sm:text-2xl font-bold truncate">Gestión de Mesas</h2>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={() => setShowAdd(true)}>Agregar mesa</button>
        </div>
      </div>

      {/* Filters - single row (mobile-first) */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-sm mr-1">Desde</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="input" />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-sm mr-1">Hasta</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="input" />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="btn-primary" onClick={() => loadVentasPorMesa(fechaInicio, fechaFin)}>Filtrar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Mesas — tarjetas responsivas */}
        <div className="col-span-1 sm:col-span-1 lg:col-span-1">
          <div className="card">
          <h3 className="text-lg font-semibold mb-2">Mesas</h3>
            {mesas.length === 0 ? (
              <p className="text-slate-400">No hay mesas configuradas</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {mesas.map(m => (
                  <article key={m.id} className="bg-slate-800 rounded-lg shadow-sm border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-300 flex-shrink-0">{m.numero}</div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{m.nombre || `Mesa ${m.numero}`}</div>
                        <div className="text-xs text-slate-500 truncate">{m.ubicacion || 'General'} • Cap: {m.capacidad || 1}</div>
                        {/* inline summary if available */}
                        {ventasPorMesa?.ventas && (
                          (() => {
                            const s = ventasPorMesa.ventas.find(v => v.mesa_id === m.id || v.mesa_numero === m.numero);
                            return s ? (
                              <div className="text-xs text-slate-400 mt-1">{s.total_comandas} cmd • {moneda} {parseFloat(s.total_vendido || 0).toFixed(2)}</div>
                            ) : null;
                          })()
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                      <button
                        className="p-2 rounded-md bg-blue-900/20 text-blue-700 hover:bg-blue-900/30"
                        onClick={() => { setSelected(m); }}
                        title="Editar"
                        aria-label="Editar mesa"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>

                      <button
                        className="px-3 py-1 rounded-md bg-orange-900/20 text-orange-700 text-sm hover:bg-orange-900/30"
                        onClick={() => handleAumentar(m)}
                        title="Aumentar capacidad"
                        aria-label="Aumentar capacidad"
                      >+1</button>

                      <button
                        className="p-2 rounded-md bg-red-900/20 text-red-700 hover:bg-red-900/30"
                        onClick={() => handleEliminar(m.id)}
                        title="Eliminar"
                        aria-label="Eliminar mesa"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                      <button
                        className="p-2 rounded-md bg-green-900/20 text-green-700 hover:bg-green-900/30"
                        onClick={async () => {
                          // Show movement (ventas) for this mesa
                          setMovementMesa(m);
                          const found = ventasPorMesa?.ventas?.find(v => v.mesa_id === m.id || v.mesa_numero === m.numero);
                          setMovementSummary(found || null);

                          try {
                            const res = await comandaService.getByMesa(m.id, { estado: 'cerrada', limit: 50 });
                            const comandas = res?.data || [];
                            // filter by our fecha range
                            const filtered = comandas.filter(c => {
                              const created = new Date(c.createdAt || c.fecha || c.created_at || c.fecha_creada);
                              const start = new Date(fechaInicio);
                              const end = new Date(fechaFin);
                              // normalize to cover whole day
                              start.setHours(0,0,0,0);
                              end.setHours(23,59,59,999);
                              return created >= start && created <= end;
                            });
                            setMovementComandas(filtered);
                          } catch (err) {
                            console.error('Error fetching comandas for mesa:', err);
                            setMovementComandas([]);
                          }
                        }}
                        title="Ver movimiento"
                        aria-label="Ver movimiento"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1v22" />
                          <path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7" />
                        </svg>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card col-span-1 sm:col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-2">Mesas con más movimiento</h3>
          {ventasPorMesa?.ventas && ventasPorMesa.ventas.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ventasPorMesa.ventas.slice(0,3).map(v => (
                <button
                  key={v.mesa_id}
                  className="p-3 bg-slate-800 rounded-lg border hover:shadow cursor-pointer text-left flex items-center justify-between"
                  onClick={async () => {
                    // reuse movement logic: open modal for this mesa
                    const mesaId = v.mesa_id;
                    const m = mesas.find(ms => ms.id === mesaId) || { numero: v.mesa_numero, nombre: v.mesa_nombre, id: mesaId };
                    setMovementMesa(m);
                    setMovementSummary(v);
                    try {
                      const res = await comandaService.getByMesa(mesaId, { estado: 'cerrada', limit: 50 });
                      const comandas = res?.data || [];
                      // filter by fecha range
                      const filtered = comandas.filter(c => {
                        const created = new Date(c.createdAt || c.fecha || c.created_at || c.fecha_creada);
                        const start = new Date(fechaInicio);
                        const end = new Date(fechaFin);
                        start.setHours(0,0,0,0);
                        end.setHours(23,59,59,999);
                        return created >= start && created <= end;
                      });
                      setMovementComandas(filtered);
                    } catch (err) {
                      console.error('Error fetching comandas for top mesa:', err);
                      setMovementComandas([]);
                    }
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{v.mesa_nombre || `Mesa ${v.mesa_numero}`}</div>
                    <div className="text-xs text-slate-500">#{v.mesa_numero} • {v.total_comandas} comandas</div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-bold text-lg">{moneda} {parseFloat(v.total_vendido || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{v.ultima_comanda ? new Date(v.ultima_comanda).toLocaleString() : '-'}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No hay datos para el período seleccionado.</p>
          )}
        </div>
      </div>

      {/* Add Mesa modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="w-full sm:w-[520px] bg-slate-800 rounded-t-xl sm:rounded-xl p-4 sm:p-6 border-t sm:border sm:border-slate-700 z-10">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold">Agregar Mesa</h4>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setShowAdd(false)} aria-label="Cerrar">✕</button>
            </div>

            <AddForm onClose={() => { setShowAdd(false); }} onAdded={async () => { setShowAdd(false); await loadMesas(); }} />
          </div>
        </div>
      )}

      {/* Edit modal (mobile-first bottom sheet) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-full sm:w-[520px] bg-slate-800 rounded-t-xl sm:rounded-xl p-4 sm:p-6 border-t sm:border sm:border-slate-700 z-10">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-lg font-semibold">Editar Mesa</h4>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setSelected(null)} aria-label="Cerrar">✕</button>
            </div>

            <EditForm
              mesa={selected}
              onClose={() => setSelected(null)}
              onSaved={async () => { setSelected(null); await loadMesas(); }}
            />
          </div>
        </div>
      )}
        {movementMesa && (
          <MovementModal
            mesa={movementMesa}
            summary={movementSummary}
            comandas={movementComandas}
            moneda={moneda}
            onClose={() => { setMovementMesa(null); setMovementSummary(null); setMovementComandas([]); }}
          />
        )}
    </div>
  );
}

function EditForm({ mesa, onClose, onSaved }) {
  const [nombre, setNombre] = useState(mesa.nombre || '');
  const [numero, setNumero] = useState(mesa.numero || '');
  const [ubicacion, setUbicacion] = useState(mesa.ubicacion || '');
  const [capacidad, setCapacidad] = useState(mesa.capacidad || 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { nombre, numero, ubicacion, capacidad };
      await mesaService.update(mesa.id, payload);
      toast.success('Mesa actualizada');
      onSaved && await onSaved();
    } catch (err) {
      console.error('Error guardando mesa:', err);
      toast.error(err.response?.data?.message || 'No se pudo actualizar la mesa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="space-y-3">
        <label className="text-xs text-slate-400">Nombre</label>
        <input className="input w-full" value={nombre} onChange={e => setNombre(e.target.value)} />

        <label className="text-xs text-slate-400">Número</label>
        <input className="input w-full" value={numero} onChange={e => setNumero(e.target.value)} />

        <label className="text-xs text-slate-400">Ubicación</label>
        <input className="input w-full" value={ubicacion} onChange={e => setUbicacion(e.target.value)} />

        <label className="text-xs text-slate-400">Capacidad</label>
        <input type="number" min={1} className="input w-full" value={capacidad} onChange={e => setCapacidad(parseInt(e.target.value||1))} />

        <div className="flex items-center justify-end gap-2 mt-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

function AddForm({ onClose, onAdded }) {
  const [nombre, setNombre] = useState('');
  const [numero, setNumero] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [capacidad, setCapacidad] = useState(1);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const payload = { nombre, numero: Number(numero), ubicacion, capacidad: Number(capacidad) };
      await mesaService.create(payload);
      toast.success('Mesa creada');
      onAdded && await onAdded();
    } catch (err) {
      console.error('Error creando mesa:', err);
      toast.error(err.response?.data?.message || 'No se pudo crear la mesa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="space-y-3">
        <label className="text-xs text-slate-400">Nombre</label>
        <input className="input w-full" value={nombre} onChange={e => setNombre(e.target.value)} />

        <label className="text-xs text-slate-400">Número</label>
        <input className="input w-full" value={numero} onChange={e => setNumero(e.target.value)} type="number" />

        <label className="text-xs text-slate-400">Ubicación</label>
        <input className="input w-full" value={ubicacion} onChange={e => setUbicacion(e.target.value)} />

        <label className="text-xs text-slate-400">Capacidad</label>
        <input type="number" min={1} className="input w-full" value={capacidad} onChange={e => setCapacidad(parseInt(e.target.value||1))} />

        <div className="flex items-center justify-end gap-2 mt-2">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creando...' : 'Crear'}</button>
        </div>
      </div>
    </div>
  );
}

// Movement modal shows comandas or summary for a mesa
function MovementModal({ mesa, summary, comandas, moneda, onClose }) {
  // compute fallback totals from comandas if summary not provided
  const totalFromComandas = (comandas || []).reduce((s, c) => s + (parseFloat(c.total) || parseFloat(c.totalGeneral) || 0), 0);
  const comandasCount = (comandas || []).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="w-full sm:w-[520px] bg-slate-800 rounded-t-xl sm:rounded-xl p-4 sm:p-6 border-t sm:border sm:border-slate-700 z-10">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-lg font-semibold">Movimiento — {mesa.nombre || `Mesa ${mesa.numero}`}</h4>
          <button className="text-slate-500 hover:text-slate-300" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Summary / totals */}
        <div className="mb-3 p-3 bg-slate-900 rounded border">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">Resumen</div>
              <div className="text-xs text-slate-500">Periodo seleccionado</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{moneda} {((summary && parseFloat(summary.total_vendido)) || totalFromComandas || 0).toFixed(2)}</div>
              <div className="text-xs text-slate-400">{(summary && summary.total_comandas) || comandasCount} comandas</div>
            </div>
          </div>
        </div>

        {comandas && comandas.length > 0 ? (
          <div className="space-y-3">
            {comandas.map(c => (
              <div key={c.id || c.comanda_id} className="p-3 bg-slate-900 rounded border">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-semibold">Comanda #{c.id || c.comanda_id}</div>
                    <div className="text-xs text-slate-500">{new Date(c.createdAt || c.fecha || c.fecha_creada || c.created_at).toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-2">Mesero: {c.usuarioAtencion?.nombre || (c.usuario_atencion && c.usuario_atencion.nombre) || '-'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{moneda} {(parseFloat(c.total) || parseFloat(c.totalGeneral) || 0).toFixed(2)}</div>
                    <div className="text-xs text-slate-500">Estado: {c.estado}</div>
                  </div>
                </div>

                {c.pedidos && c.pedidos.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    {c.pedidos.map(p => (
                      <div key={p.id || p.pedido_id} className="flex justify-between">
                        <div>{p.cantidad} x {p.producto?.nombre || p.producto_nombre}</div>
                        <div>{moneda} {(parseFloat(p.subtotal) || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">No hay movimiento para este periodo</p>
        )}
      </div>
    </div>
  );
}
