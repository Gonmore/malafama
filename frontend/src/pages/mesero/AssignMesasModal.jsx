import React, { useState, useEffect } from 'react';
import { mesaService } from '../../services/mesaService';
import { toast } from 'react-hot-toast';

export default function AssignMesasModal({ visible, onClose, onAssigned, mesasInicial, assignedInicial }) {
  const [selected, setSelected] = useState(new Set(assignedInicial || []));
  const [saving, setSaving] = useState(false);
  const [mesas, setMesas] = useState(mesasInicial || []);

  useEffect(() => {
    setSelected(new Set(assignedInicial || []));
  }, [assignedInicial]);

  useEffect(() => {
    setMesas(mesasInicial || []);
  }, [mesasInicial]);

  if (!visible) return null;

  const toggle = (id) => {
    setSelected(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      const mesaIds = Array.from(selected);
      await mesaService.assignMesas(mesaIds);
      toast.success('Mesas asignadas correctamente');
      onAssigned(mesaIds);
      onClose();
    } catch (error) {
      console.error('Error al asignar mesas:', error);
      toast.error(error.response?.data?.message || 'Error al asignar mesas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold">Asignar Mesas</h3>
        <p className="text-sm text-gray-500 mb-3">Selecciona las mesas que te corresponden hoy</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {mesas.map(m => {
            const isSelected = selected.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`p-3 text-left rounded-lg border transition-colors flex flex-col justify-between h-28 ${isSelected ? 'border-blue-500 bg-blue-50 shadow-inner' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Mesa {m.numero}</div>
                    <div className="text-xs text-gray-500">{m.ubicacion || 'General'}</div>
                  </div>
                  <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-400'}`}>{m.capacidad}p</div>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">Toca para {isSelected ? 'quitar' : 'asignar'}</div>
              </button>
            );
          })}
          {mesas.length === 0 && (
            <div className="text-sm text-gray-500">No hay mesas para asignar</div>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancelar</button>
          <button disabled={saving} onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
