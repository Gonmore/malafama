/**
 * Test de conectividad real al servidor backend
 * Intenta conectarse a la URL privada con un timeout corto
 */
const testConnectivity = async (url: string, timeout: number = 3000): Promise<boolean> => {
  try {
    console.log(`🧪 Probando conectividad a: ${url}`);
    
    // Crear un AbortController para el timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${url}/api/v1/auth/test`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    // Si obtenemos respuesta (incluso 404), significa que hay conectividad
    console.log(`✅ Conectividad exitosa a ${url} (status: ${response.status})`);
    return true;
  } catch (error: any) {
    clearTimeout(0);
    console.log(`❌ Fallo conectividad a ${url}:`, error?.message);
    return false;
  }
};

/**
 * Detecta si el dispositivo puede alcanzar el servidor en la red local
 * mediante un test de conectividad real
 */
export const detectNetworkType = async (): Promise<{
  isLocalNetwork: boolean;
  privateUrl: string;
  publicUrl: string;
}> => {
  const privateUrl = process.env.EXPO_PRIVATE_API_URL || 'http://192.168.10.57:5000';
  const publicUrl = process.env.EXPO_PUBLIC_API_URL || 'http://177.222.118.57:5000';

  try {
    console.log('🌐 Detectando red...');

    // Test de conectividad real a la URL privada
    const canReachPrivate = await testConnectivity(privateUrl, 3000);

    return {
      isLocalNetwork: canReachPrivate,
      privateUrl,
      publicUrl,
    };
  } catch (error) {
    console.error('❌ Error detecting network:', error);
    // En caso de error, asumir que es red pública (URL pública)
    return {
      isLocalNetwork: false,
      privateUrl,
      publicUrl,
    };
  }
};

/**
 * Obtiene la URL base del API según la conectividad real
 */
export const getApiBaseUrl = async (): Promise<string> => {
  const networkInfo = await detectNetworkType();
  
  if (networkInfo.isLocalNetwork) {
    console.log('✅ Usando URL privada (se detectó conectividad a la red local)');
    return networkInfo.privateUrl;
  } else {
    console.log('✅ Usando URL pública (no hay conectividad a la red local)');
    return networkInfo.publicUrl;
  }
};

/**
 * Obtiene la URL del WebSocket según la conectividad real
 */
export const getWsBaseUrl = async (): Promise<string> => {
  return getApiBaseUrl(); // WebSocket usa la misma URL base
};

