import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import localService from '../../services/localService';
import { useAuthStore } from '../../store/authStore';
import { reporteService } from '../../services/reporteService';
import proveedorService from '../../services/proveedorService';

export default function ProveedoresManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [localId, setLocalId] = useState(user?.local?.id || null);
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [selectedProv, setSelectedProv] = useState(null);
  const [provDetalle, setProvDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!localId) return;
    loadData();
  }, [localId, startDate, endDate]);

  // load locales list for admin to select
  useEffect(() => {
    const cargarLocales = async () => {
      try {
        const res = await localService.obtenerLocales();
        const list = res.data?.locales || res.data || [];
        setLocales(list);
        if (!localId && list.length > 0) setLocalId(list[0].id);
      } catch (err) {
        console.error('Error al cargar locales:', err);
      }
    };

    cargarLocales();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // fetch providers (all) and then fetch owed amounts within the range
      const timestamp = Date.now();
      const [provResp, pagosResp] = await Promise.allSettled([
        proveedorService.getAll({ localId, t: timestamp }),
        reporteService.getPagosSemanaProveedores(localId, startDate, endDate, timestamp)
      ]);

      const allProveedores = provResp.status === 'fulfilled' ? (provResp.value.data || provResp.value.proveedores || provResp.value || []) : [];
      const pagosRows = pagosResp.status === 'fulfilled' ? (pagosResp.value.data?.proveedores || pagosResp.value.proveedores || []) : [];

      // Build lookup maps and union providers from both sources (prov list + pagos rows)
      const pagosMap = {};
      pagosRows.forEach(p => { pagosMap[p.proveedor_id] = p; });

      const provMap = {};
      (allProveedores || []).forEach(p => {
        provMap[p.id] = p;
      });

      // Produce union of provider ids from both sources
      const idsSet = new Set([...(Object.keys(provMap)), ...(Object.keys(pagosMap))]);
      const merged = Array.from(idsSet).map(id => {
        const p = provMap[id] || {};
        const pago = pagosMap[id] || null;
        return {
          proveedor_id: id,
          proveedor: p.nombre || pago?.proveedor || '—',
          telefono: p.telefono || p.contacto || pago?.telefono || (p.usuario?.telefono || ''),
          email: p.email || (p.usuario?.email || null) || pago?.email || null,
          unidades_vendidas: pago ? pago.unidades_vendidas : 0,
          monto_adeudado: pago ? pago.monto_adeudado : '0.00',
          comandas: pago ? pago.comandas : 0
        };
      });

      setProveedores(merged);
    } catch (err) {
      console.error('Error fetching provider weekly:', err);
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsApp = (prov) => {
    const phone = (prov.telefono || prov.phone || '').replace(/\D/g, '');
    if (!phone) return alert('Proveedor no tiene teléfono disponible');
    const msg = `Hola ${prov.proveedor}, te informamos el resumen de ventas del período ${startDate} → ${endDate}.\n\n` +
      `Unidades vendidas: ${prov.unidades_vendidas || 0}\n` +
      `Monto adeudado: ${prov.monto_adeudado || '0.00'}\n\n` +
      `Por favor confirma recepción y envía comprobante de pago cuando corresponda.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/dashboard')} className="px-2 py-1 rounded bg-gray-100 text-sm">← Volver</button>
          <div>
            <h1 className="text-2xl font-bold">Proveedores — Resumen semanal</h1>
            <p className="text-sm text-gray-500">Resumen por proveedor del costo de productos vendidos en el período seleccionado</p>
          </div>
        </div>
        {/* main title moved to the left; removed duplicate header */}
        <div className="flex items-center gap-2">
          {locales.length > 0 && (
            <select value={localId || ''} onChange={(e) => setLocalId(e.target.value)} className="px-3 py-2 rounded border">
              {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          )}
          <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="px-3 py-2 rounded border" />
          <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="px-3 py-2 rounded border" />
          <button onClick={loadData} className="px-3 py-2 rounded bg-blue-600 text-white">Actualizar</button>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4">
        {loading ? (
          <div className="text-center py-8">Cargando...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-600 border-b">
                <th className="py-2 px-2">Proveedor</th>
                <th className="py-2 px-2">Contacto</th>
                <th className="py-2 px-2">Unidades</th>
                <th className="py-2 px-2">Monto adeudado</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-gray-500">
                    <div>No se encontraron proveedores para este local y período.</div>
                    <div className="mt-3">
                      <button onClick={() => navigate('/admin/productos')} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Ir a administrar proveedores / productos</button>
                      <span className="text-xs text-gray-400 block mt-2">Si quieres datos de prueba, ejecuta <code>npm run seed:proveedores:demo</code> en el backend.</span>
                    </div>
                  </td>
                </tr>
              ) : proveedores.map(p => (
                <tr key={p.proveedor_id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetalle(p)}>
                  <td className="py-3 px-2 font-semibold">{p.proveedor}</td>
                  <td className="py-3 px-2 text-sm">
                    {p.telefono ? <div>{p.telefono}</div> : <div className="text-xs text-gray-400">Sin teléfono</div>}
                    {p.email ? <div className="text-xs text-gray-500">{p.email}</div> : null}
                  </td>
                  <td className="py-3 px-2">{p.unidades_vendidas || 0}</td>
                  <td className="py-3 px-2">Bs {parseFloat(p.monto_adeudado || 0).toFixed(2)}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>sendWhatsApp(p)} className="px-3 py-1 rounded bg-green-500 text-white text-sm" disabled={!p.telefono}>Enviar WhatsApp</button>
                      <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={(e)=>{ e.stopPropagation(); alert('Funcionalidad de comprobante no implementada aún') }}>Adjuntar comprobante</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detalle modal */}
      {selectedProv && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded p-6 w-full max-w-2xl shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Detalle - {selectedProv.proveedor}</h3>
                <p className="text-xs text-gray-500">Período: {startDate} → {endDate}</p>
              </div>
              <div>
                <button onClick={() => { setSelectedProv(null); setProvDetalle(null); }} className="px-2 py-1 rounded">Cerrar</button>
              </div>
            </div>

            {detalleLoading ? (
              <div className="p-6 text-center">Cargando detalle...</div>
            ) : provDetalle ? (
              <div>
                <div className="mb-4 text-sm text-gray-600">Total adeudado: <strong>Bs {provDetalle.resumen.total}</strong></div>
                <table className="w-full text-left border-collapse">
                  <thead className="text-xs text-gray-600 border-b">
                    <tr>
                      <th className="py-2 px-2">Producto</th>
                      <th className="py-2 px-2">Unidades</th>
                      <th className="py-2 px-2">Monto adeudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provDetalle.productos.map(prod => (
                      <tr key={prod.producto_id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">{prod.producto}</td>
                        <td className="py-2 px-2">{prod.unidades_vendidas || 0}</td>
                        <td className="py-2 px-2">Bs {parseFloat(prod.monto_adeudado || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-gray-500">Seleccione un proveedor para ver detalle</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  async function openDetalle(p) {
    setSelectedProv(p);
    setDetalleLoading(true);
    try {
      const res = await reporteService.getDetalleProveedor(p.proveedor_id, localId, startDate, endDate);
      setProvDetalle(res.data || res);
    } catch (err) {
      console.error('Error fetching detalle prov:', err);
      setProvDetalle(null);
    } finally {
      setDetalleLoading(false);
    }
  }
}
