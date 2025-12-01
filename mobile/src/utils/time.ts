export function formatTimeShort(ts?: string | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

export function getMinutosTranscurridos(ts?: string | null) {
  if (!ts) return 0;
  try {
    const ahora = new Date().getTime();
    const creacion = new Date(ts).getTime();
    const diff = ahora - creacion;
    return Math.floor(diff / 60000); // milisegundos a minutos
  } catch (e) {
    return 0;
  }
}
