import { useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function PagoModal({ comanda, totalGeneral, onClose, onPagoConfirmado, darkMode = false }) {
  const { user } = useAuthStore();
  const [metodoPago, setMetodoPago] = useState(null); // 'efectivo', 'qr', 'mixto'
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [imagenComprobante, setImagenComprobante] = useState(null);
  const [previewImagen, setPreviewImagen] = useState(null);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagenComprobante(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImagen(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const abrirCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setMostrarCamara(true);
      }
    } catch (error) {
      console.error('Error al abrir cámara:', error);
      toast.error('No se pudo acceder a la cámara');
    }
  };

  const tomarFoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], 'comprobante.jpg', { type: 'image/jpeg' });
        setImagenComprobante(file);
        setPreviewImagen(canvas.toDataURL());
        cerrarCamara();
      }, 'image/jpeg');
    }
  };

  const cerrarCamara = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setMostrarCamara(false);
  };

  const confirmarPago = () => {
    // Validaciones
    if (!metodoPago) {
      toast.error('Selecciona un método de pago');
      return;
    }

    if (metodoPago === 'qr' && !imagenComprobante) {
      toast.error('Debes subir o tomar una foto del comprobante');
      return;
    }

    if (metodoPago === 'mixto') {
      if (!montoEfectivo || parseFloat(montoEfectivo) <= 0) {
        toast.error('Ingresa el monto en efectivo');
        return;
      }
      if (parseFloat(montoEfectivo) >= totalGeneral) {
        toast.error('El monto en efectivo debe ser menor al total');
        return;
      }
      if (!imagenComprobante) {
        toast.error('Debes subir el comprobante del pago QR');
        return;
      }
    }

    // Preparar datos del pago
    const datoPago = {
      metodoPago,
      total: totalGeneral,
      montoEfectivo: metodoPago === 'mixto' ? parseFloat(montoEfectivo) : null,
      montoQr: metodoPago === 'mixto' ? totalGeneral - parseFloat(montoEfectivo) : null,
      comprobante: previewImagen || null // Enviar base64/data URL
    };

    onPagoConfirmado(datoPago);
  };

  const montoQr = metodoPago === 'mixto' && montoEfectivo 
    ? (totalGeneral - parseFloat(montoEfectivo)).toFixed(2) 
    : totalGeneral.toFixed(2);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 flex items-center justify-between shadow-lg flex-shrink-0 rounded-t-3xl sm:rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-bold">💰 Generar Cuenta</h2>
            <p className="text-sm text-green-100 mt-1">Comanda #{comanda?.id?.slice?.(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Total a pagar */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg mb-6">
            <p className="text-sm uppercase tracking-wide font-semibold mb-1">Total a pagar</p>
            <p className="text-5xl font-bold">
              {user?.local?.moneda || 'Bs'} {totalGeneral.toFixed(2)}
            </p>
          </div>

          {/* Métodos de pago */}
          <div className="mb-6">
            <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Método de pago</h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => setMetodoPago('efectivo')}
                className={`p-3 sm:p-5 rounded-xl border-2 transition-all ${
                  metodoPago === 'efectivo'
                    ? 'border-green-500 bg-green-50 shadow-lg'
                    : darkMode 
                      ? 'border-gray-700 bg-gray-800 hover:border-green-300' 
                      : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">💵</div>
                <div className={`font-bold text-xs sm:text-base ${metodoPago === 'efectivo' ? 'text-gray-800' : darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Efectivo</div>
              </button>

              <button
                onClick={() => setMetodoPago('qr')}
                className={`p-3 sm:p-5 rounded-xl border-2 transition-all ${
                  metodoPago === 'qr'
                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                    : darkMode 
                      ? 'border-gray-700 bg-gray-800 hover:border-blue-300' 
                      : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">📱</div>
                <div className={`font-bold text-xs sm:text-base ${metodoPago === 'qr' ? 'text-gray-800' : darkMode ? 'text-gray-200' : 'text-gray-800'}`}>QR</div>
              </button>

              <button
                onClick={() => setMetodoPago('mixto')}
                className={`p-3 sm:p-5 rounded-xl border-2 transition-all ${
                  metodoPago === 'mixto'
                    ? 'border-purple-500 bg-purple-50 shadow-lg'
                    : darkMode 
                      ? 'border-gray-700 bg-gray-800 hover:border-purple-300' 
                      : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="text-2xl sm:text-4xl mb-1 sm:mb-2">💳</div>
                <div className={`font-bold text-xs sm:text-base ${metodoPago === 'mixto' ? 'text-gray-800' : darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Mixto</div>
              </button>
            </div>
          </div>

          {/* Opciones según método de pago */}
          {metodoPago === 'mixto' && (
            <div className={`mb-6 p-4 rounded-xl border ${
              darkMode ? 'bg-gray-800 border-gray-700' : 'bg-purple-50 border-purple-200'
            }`}>
              <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Monto en efectivo ({user?.local?.moneda || 'Bs'})
              </label>
              <input
                type="number"
                step="0.01"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                className={`w-full px-4 py-3 border-2 rounded-lg text-lg font-bold ${
                  darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'border-purple-300 bg-white text-gray-900'
                }`}
                placeholder="0.00"
              />
              {montoEfectivo && parseFloat(montoEfectivo) > 0 && parseFloat(montoEfectivo) < totalGeneral && (
                <div className={`mt-3 p-3 rounded-lg ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Monto por QR:</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {user?.local?.moneda || 'Bs'} {montoQr}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Comprobante (QR o Mixto) */}
          {(metodoPago === 'qr' || metodoPago === 'mixto') && (
            <div className="mb-6">
              <h3 className={`text-lg font-bold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Comprobante de pago</h3>
              
              {!previewImagen && !mostrarCamara && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={abrirCamara}
                    className="px-4 py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition"
                  >
                    📸 Tomar foto
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-4 py-4 border-2 rounded-xl font-semibold transition ${
                      darkMode ? 'border-gray-600 text-gray-200 hover:border-blue-400' : 'border-gray-300 text-gray-800 hover:border-blue-400'
                    }`}
                  >
                    📂 Subir archivo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {mostrarCamara && (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-xl"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={tomarFoto}
                      className="flex-1 px-4 py-3 bg-green-500 text-white rounded-xl font-bold"
                    >
                      📸 Capturar
                    </button>
                    <button
                      onClick={cerrarCamara}
                      className={`px-4 py-3 border-2 rounded-xl font-semibold ${
                        darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {previewImagen && (
                <div className="relative">
                  <img src={previewImagen} alt="Comprobante" className="w-full rounded-xl border-2 border-green-300" />
                  <button
                    onClick={() => {
                      setPreviewImagen(null);
                      setImagenComprobante(null);
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 flex gap-3 border-t flex-shrink-0 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-3 border-2 rounded-xl font-semibold ${
              darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={confirmarPago}
            disabled={!metodoPago}
            className={`flex-1 px-4 py-3 rounded-xl font-bold text-white ${
              metodoPago
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            ✅ Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
