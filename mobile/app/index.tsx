import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth';

export default function Index() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  if (!token || !user) {
    return <Redirect href="/login" />;
  }

  const tipo = user.tipo || 'admin';
  const route =
    tipo === 'atencion' ? '/mesero' :
    tipo === 'cocina' ? '/cocina' :
    tipo === 'bar' ? '/bar' :
    tipo === 'proveedor' ? '/proveedor' :
    '/home'; // default to home for admin or unknown

  return <Redirect href={route} />;
}
