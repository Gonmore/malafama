import { Bell, ClipboardList, Hand, Home, User, Users, CalendarDays, Plus, Check } from 'lucide-react';

export const STATUS_STYLE = {
  libre: { label: 'Libre', color: '#94a3b8', bg: '#1e293b', border: '#334155' },
  preparando: { label: 'Preparando', color: '#60a5fa', bg: '#0f172a', border: '#1d4ed8' },
  parcial: { label: 'Parcial', color: '#fb7185', bg: '#1f1722', border: '#be123c' },
  listo: { label: 'Listo', color: '#34d399', bg: '#0f1f1b', border: '#059669' },
  cuenta: { label: 'Cuenta', color: '#fbbf24', bg: '#1f1a11', border: '#d97706' },
  pagada: { label: 'Pagada', color: '#d8b4fe', bg: '#2e1a47', border: '#a78bfa' },
  completa: { label: 'Completa', color: '#f43f5e', bg: '#21111c', border: '#be123c' },
};

export const OCCUPIED_SEAT_STATES = new Set(['vendido', 'cortesia']);

export function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'MF';
}

export function formatEventLine(evento) {
  if (!evento) return 'Evento activo';
  const hour = evento.horaInicio || evento.hora_inicio || '';
  return `${evento.titulo || evento.nombre || 'Evento'}${hour ? ` · ${hour}` : ''}`;
}

export function formatAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'Ahora';
  if (mins === 1) return 'Hace 1 min';
  return `Hace ${mins} min`;
}

export function ComandasPhoneShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col bg-slate-900 shadow-2xl xl:border-x xl:border-slate-800/80">
        {children}
      </div>
    </div>
  );
}

export function EventHeader({ user, evento, supervisor = false, onEventClick, eventButtonText }) {
  const initials = getInitials(user?.nombre || (supervisor ? 'PJ' : 'MQ'));
  return (
    <header className="border-b border-slate-800 bg-slate-900 px-4 pb-5 pt-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-base font-bold text-white">MF</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">
            {supervisor ? 'Supervisor · vista asignación' : (user?.nombre || 'Mesero')}
          </h1>
          <p className="truncate text-sm font-semibold text-slate-400">
            {supervisor ? 'Antes del show' : formatEventLine(evento)}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${supervisor ? 'bg-rose-500' : 'bg-blue-600'}`}>
          {initials}
        </div>
      </div>

      <button
        type="button"
        onClick={onEventClick}
        disabled={!onEventClick}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-left text-slate-100 disabled:cursor-default"
      >
        <CalendarDays className="h-6 w-6 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-base font-bold">{eventButtonText || formatEventLine(evento)}</span>
        {onEventClick && <span className="text-2xl leading-none text-white">⌄</span>}
      </button>
    </header>
  );
}

export function SeatDots({ seats = [], status = 'libre' }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.libre;
  const seatMap = new Map((seats || []).map((seat) => [seat.letra, seat.estado]));
  return (
    <div className="flex items-center justify-center gap-2">
      {['A', 'B', 'C', 'D'].map((letter) => {
        const occupied = OCCUPIED_SEAT_STATES.has(seatMap.get(letter));
        return (
          <span
            key={letter}
            title={`${letter}: ${seatMap.get(letter) || 'disponible'}`}
            className="h-[13px] w-[13px] rounded-full border-2"
            style={{
              backgroundColor: occupied ? style.color : 'transparent',
              borderColor: occupied ? style.color : '#64748b',
            }}
          />
        );
      })}
    </div>
  );
}

export function sortMesasByOperationalPriority(mesas = [], getStatus) {
  const priority = {
    listo: 0,
    parcial: 1,
    preparando: 2,
    cuenta: 3,
    pagada: 4,
    libre: 5,
    completa: 6,
  };

  return [...mesas].sort((a, b) => {
    const statusA = getStatus(a);
    const statusB = getStatus(b);
    const diff = (priority[statusA] ?? 99) - (priority[statusB] ?? 99);
    if (diff !== 0) return diff;
    return Number(a?.numero || 0) - Number(b?.numero || 0);
  });
}

export function TableCard({ mesa, status = 'libre', subtext, onClick, assignee, assigneeColor, selectedOutline = false, muted = false, showSeats = true }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.libre;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-[132px] rounded-[16px] p-3 text-center transition active:scale-[0.98] ${muted ? 'opacity-55' : 'opacity-100'}`}
      style={{
        backgroundColor: style.bg,
        border: `1.5px solid ${assigneeColor || style.border}`,
        boxShadow: selectedOutline ? `0 0 0 4px #2563eb, inset 0 0 0 1px ${style.border}` : 'none',
      }}
    >
      {assignee && (
        <span
          className="absolute left-4 top-3 max-w-[76px] truncate rounded-lg px-3 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: `${assigneeColor}33`, color: assigneeColor || '#bfdbfe' }}
        >
          {assignee}
        </span>
      )}
      <span className="absolute right-4 top-4 h-3 w-3 rounded-full" style={{ backgroundColor: style.color }} />
      <div className="mt-2 text-[34px] font-light leading-none text-white">{mesa?.numero}</div>
      {showSeats && <div className="mt-3"><SeatDots seats={mesa?.seatStates || []} status={status} /></div>}
      <div className="mt-2 text-sm font-medium" style={{ color: style.color }}>{style.label}</div>
      <div className="mx-auto mt-2 min-h-[32px] max-w-[120px] text-xs font-semibold leading-tight text-slate-400">{subtext}</div>
    </button>
  );
}

export function AlertStack({ alertas = [], onAction }) {
  const ordered = [...alertas].sort((a, b) => {
    if (a.tipo === b.tipo) return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return a.tipo === 'llamada' ? -1 : 1;
  });

  if (ordered.length === 0) return null;

  return (
    <div>
      {ordered.map((alerta) => {
        const isCall = alerta.tipo === 'llamada';
        const color = isCall ? '#f59e0b' : '#34d399';
        const bg = isCall ? '#1f1508' : '#0f1f1b';
        const buttonBg = isCall ? '#92400e' : '#047857';
        const mesaNumero = alerta.mesa?.numero || '';
        const comandaChunk = alerta.comandaNumero ? ` Comanda #${alerta.comandaNumero}` : '';
        return (
          <div key={alerta.id} className="flex items-center gap-4 border-b px-4 py-4 sm:px-6 lg:px-8" style={{ backgroundColor: bg, borderColor: `${color}40` }}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }}>
              {isCall ? <Hand className="h-6 w-6 text-white" /> : <Check className="h-7 w-7 text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-bold" style={{ color }}>{isCall ? `Mesa ${mesaNumero} llama al mesero` : `Mesa ${mesaNumero}${comandaChunk} lista para entregar`}</div>
              <div className="text-sm font-semibold text-slate-400">{formatAgo(alerta.createdAt)}</div>
            </div>
            <button
              type="button"
              onClick={() => onAction?.(alerta)}
              className="rounded-xl px-4 py-2 text-sm font-bold"
              style={{ backgroundColor: buttonBg, color: isCall ? '#ffd38b' : '#bfffdc' }}
            >
              {isCall ? 'Atender' : 'Entregar'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div className="flex border-b border-slate-800 bg-slate-900">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`relative flex-1 px-2 py-4 text-sm font-semibold sm:text-base ${value === tab.key ? 'text-slate-100' : 'text-slate-400'}`}
        >
          {tab.label}
          {value === tab.key && <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />}
        </button>
      ))}
    </div>
  );
}

export function BottomNav({ active = 'mesas', supervisor = false }) {
  const items = supervisor
    ? [
      { key: 'mesas', label: 'Mis mesas', icon: Home },
      { key: 'alertas', label: 'Alertas', icon: Bell },
      { key: 'asignacion', label: 'Asignación', icon: Users },
      { key: 'perfil', label: 'Perfil', icon: User },
    ]
    : [
      { key: 'mesas', label: 'Mis mesas', icon: Home },
      { key: 'alertas', label: 'Alertas', icon: Bell },
      { key: 'comandas', label: 'Comandas', icon: ClipboardList },
      { key: 'perfil', label: 'Perfil', icon: User },
    ];

  return (
    <nav className="grid grid-cols-4 border-t border-slate-800 bg-slate-900 px-4 py-4 sm:px-6 lg:px-8">
      {items.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" className={`flex flex-col items-center gap-1 text-xs font-semibold ${active === key ? 'text-blue-400' : 'text-slate-500'}`}>
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function AddCircle({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 shrink-0 flex-col items-center gap-2">
      <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full border-2 border-dashed border-slate-600 text-slate-400">
        <Plus className="h-7 w-7" />
      </span>
      <span className="text-xs font-semibold text-slate-400">Agregar</span>
    </button>
  );
}
