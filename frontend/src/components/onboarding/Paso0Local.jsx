import React, { useState } from 'react';

const Paso0Local = ({ onCompletar, datosIniciales }) => {
  const [formData, setFormData] = useState({
    nombre: datosIniciales?.nombre || '',
    descripcion: datosIniciales?.descripcion || '',
    direccion: datosIniciales?.direccion || '',
    telefono: datosIniciales?.telefono || '',
    email: datosIniciales?.email || '',
    logo: datosIniciales?.logo || '',
    moneda: datosIniciales?.moneda || 'Bs'
  });

  const monedas = [
    { code: 'Bs', name: 'Bolivianos', flag: '🇧🇴', pais: 'Bolivia' },
    { code: '$', name: 'Dólares', flag: '🇺🇸', pais: 'Estados Unidos' },
    { code: 'S/', name: 'Soles', flag: '🇵🇪', pais: 'Perú' },
    { code: 'AR$', name: 'Pesos Argentinos', flag: '🇦🇷', pais: 'Argentina' },
    { code: 'R$', name: 'Reales', flag: '🇧🇷', pais: 'Brasil' },
    { code: 'BsF', name: 'Bolívares', flag: '🇻🇪', pais: 'Venezuela' },
    { code: 'MX$', name: 'Pesos Mexicanos', flag: '🇲🇽', pais: 'México' },
    { code: 'COP$', name: 'Pesos Colombianos', flag: '🇨🇴', pais: 'Colombia' },
    { code: 'CLP$', name: 'Pesos Chilenos', flag: '🇨🇱', pais: 'Chile' },
    { code: '€', name: 'Euros', flag: '🇪🇺', pais: 'Europa' },
    { code: 'UYU$', name: 'Pesos Uruguayos', flag: '🇺🇾', pais: 'Uruguay' },
    { code: 'PYG', name: 'Guaraníes', flag: '🇵🇾', pais: 'Paraguay' }
  ];

  const [errors, setErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState(datosIniciales?.logo || null);
  const [procesandoLogo, setProcesandoLogo] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar error del campo al escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, logo: 'Solo se permiten imágenes' }));
        return;
      }

      // Validar tamaño (máximo 5MB antes de procesar)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: 'La imagen no debe superar 5MB' }));
        return;
      }

      setProcesandoLogo(true);
      
      // Procesar y redimensionar imagen
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Crear canvas para redimensionar a 48x48px
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Tamaño objetivo: 48x48 (para móvil)
          const targetSize = 48;
          canvas.width = targetSize;
          canvas.height = targetSize;
          
          // Calcular dimensiones para mantener aspect ratio
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          
          // Recortar al centro si la imagen no es cuadrada
          if (img.width > img.height) {
            sourceX = (img.width - img.height) / 2;
            sourceWidth = img.height;
          } else if (img.height > img.width) {
            sourceY = (img.height - img.width) / 2;
            sourceHeight = img.width;
          }
          
          // Dibujar imagen redimensionada
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, targetSize, targetSize
          );
          
          // Convertir a Base64 con calidad optimizada
          // Usar PNG para soportar transparencia
          const optimizedBase64 = canvas.toDataURL('image/png', 0.9);
          
          // Verificar tamaño final
          const finalSize = (optimizedBase64.length * 3) / 4; // Aproximación del tamaño en bytes
          
          console.log('📊 Logo procesado:', {
            dimensiones: `${targetSize}x${targetSize}px`,
            formato: 'PNG',
            calidad: '90%',
            tamañoBytes: Math.round(finalSize),
            tamañoKB: Math.round(finalSize / 1024)
          });
          
          if (finalSize > 100 * 1024) { // Si supera 100KB
            setErrors(prev => ({ 
              ...prev, 
              logo: 'La imagen es muy compleja. Por favor, use una imagen más simple.' 
            }));
            setProcesandoLogo(false);
            return;
          }
          
          setLogoPreview(optimizedBase64);
          setFormData(prev => ({
            ...prev,
            logo: optimizedBase64
          }));
          setErrors(prev => ({ ...prev, logo: '' }));
          setProcesandoLogo(false);
        };
        img.onerror = () => {
          setErrors(prev => ({ ...prev, logo: 'Error al procesar la imagen' }));
          setProcesandoLogo(false);
        };
        img.src = event.target.result;
      };
      reader.onerror = () => {
        setErrors(prev => ({ ...prev, logo: 'Error al leer el archivo' }));
        setProcesandoLogo(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFormData(prev => ({
      ...prev,
      logo: ''
    }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.nombre || formData.nombre.trim().length < 3) {
      newErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresa un email válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validate()) {
      onCompletar(formData);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Crear tu Local</h2>
        <p className="text-gray-600">
          Comienza configurando la información básica de tu restaurante
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre del Local */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre del Local *
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            placeholder="Ej: La Terraza del Centro"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.nombre ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.nombre && (
            <p className="mt-1 text-sm text-red-600">{errors.nombre}</p>
          )}
        </div>

        {/* Moneda */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Moneda del Local *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Esta moneda se usará en todos los precios y costos del sistema
          </p>
          <select
            name="moneda"
            value={formData.moneda}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            {monedas.map(m => (
              <option key={m.code} value={m.code}>
                {m.flag} {m.name} ({m.code}) - {m.pais}
              </option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Describe tu local..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo del Local (opcional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Este logo aparecerá en las interfaces de meseros y cocina. Se redimensionará automáticamente a 48x48px.
          </p>
          
          {logoPreview ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-24 h-24 object-contain border-2 border-gray-300 rounded-lg bg-white p-2"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">✅ Logo optimizado (48x48px PNG)</p>
                <button
                  type="button"
                  onClick={() => document.getElementById('logo-input').click()}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                  disabled={procesandoLogo}
                >
                  Cambiar logo
                </button>
              </div>
            </div>
          ) : procesandoLogo ? (
            <div className="flex items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg bg-blue-50">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-blue-600 font-medium">Procesando imagen...</p>
                <p className="text-xs text-blue-500">Redimensionando a 48x48px</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="logo-input"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF (max. 5MB)</p>
                  <p className="text-xs text-gray-400 mt-1">Se redimensionará a 48x48px</p>
                </div>
              </label>
            </div>
          )}
          <input
            id="logo-input"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="hidden"
          />
          {errors.logo && (
            <p className="mt-1 text-sm text-red-600">{errors.logo}</p>
          )}
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección (opcional)
          </label>
          <input
            type="text"
            name="direccion"
            value={formData.direccion}
            onChange={handleChange}
            placeholder="Ej: Av. Principal 123, Centro"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono (opcional)
          </label>
          <input
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            placeholder="Ej: +54 11 1234-5678"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email (opcional)
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="contacto@tulocal.com"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Resumen</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Local: <strong>{formData.nombre || '(sin nombre)'}</strong></li>
            <li>• Moneda: <strong>{monedas.find(m => m.code === formData.moneda)?.flag} {formData.moneda}</strong></li>
            {formData.direccion && <li>• Dirección: {formData.direccion}</li>}
            {formData.telefono && <li>• Teléfono: {formData.telefono}</li>}
            {formData.email && <li>• Email: {formData.email}</li>}
          </ul>
        </div>

        {/* Botón */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Continuar →
          </button>
        </div>
      </form>
    </div>
  );
};

export default Paso0Local;
