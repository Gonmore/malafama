import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import proveedorService from '../services/proveedorService';

export default function ProveedorModal({
  open,
  onClose,
  onSaved,
  localId,
  initialProveedor = null,
  title
}) {
  const isEditing = Boolean(initialProveedor?.id);

  const initialForm = useMemo(
    () => ({
      nombre: initialProveedor?.nombre || '',
      contacto: initialProveedor?.contacto || '',
      telefono: initialProveedor?.telefono || '',
      email: initialProveedor?.email || '',
      esPropio: Boolean(initialProveedor?.esPropio)
    }),
    [initialProveedor]
  );

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) setForm(initialForm);
  }, [open, initialForm]);

  if (!open) return null;

  const canSave = (form.nombre || '').trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) {
      toast.error('Nombre es requerido');
      return;
    }
    if (!localId && !isEditing) {
      toast.error('Selecciona un local antes de crear proveedor');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nombre: form.nombre.trim(),
        contacto: form.contacto?.trim() || null,
        telefono: form.telefono?.trim() || null,
        email: form.email?.trim() || null,
        esPropio: Boolean(form.esPropio)
      };

      let resp;
      if (isEditing) {
        resp = await proveedorService.update(initialProveedor.id, payload);
      } else {
        resp = await proveedorService.create({ ...payload, localId });
      }

      const saved = resp?.data?.proveedor || resp?.data || resp?.proveedor || resp;
      toast.success(isEditing ? 'Proveedor actualizado' : 'Proveedor creado');
      if (typeof onSaved === 'function') onSaved(saved);
      onClose?.();
    } catch (err) {
      console.error('Error guardando proveedor:', err);
      toast.error(err?.response?.data?.message || 'Error al guardar proveedor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {title || (isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor')}
          </h2>
          <button
            type="button"
            onClick={() => (saving ? null : onClose?.())}
            className="px-2 py-1 rounded text-gray-600 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
            <input
              value={form.contacto}
              onChange={(e) => setForm({ ...form, contacto: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.esPropio}
              onChange={(e) => setForm({ ...form, esPropio: e.target.checked })}
            />
            Proveedor propio
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => (saving ? null : onClose?.())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave || saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
