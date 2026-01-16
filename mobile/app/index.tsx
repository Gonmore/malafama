import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  console.log('[DEBUG Index] token exists:', !!token);
  console.log('[DEBUG Index] user:', user);
  console.log('[DEBUG Index] user.tipo:', user?.tipo);

  if (!token || !user) {
    console.log('[DEBUG Index] Redirecting to /login');
    return <Redirect href="/login" />;
  }

  const tipo = user.tipo || 'admin';
  const route =
    tipo === 'atencion' ? '/mesero' :
    tipo === 'cocina' ? '/cocina' :
    tipo === 'bar' ? '/bar' :
    tipo === 'proveedor' ? '/proveedor' :
    tipo === 'admin' ? '/admin/select-local' : // admin selecciona local primero
    '/mesero'; // fallback para roles desconocidos

  console.log('[DEBUG Index] Calculated tipo:', tipo);
  console.log('[DEBUG Index] Redirecting to:', route);

  return <Redirect href={route} />;
}
