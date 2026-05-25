import { COLOR_ESTADO } from '../constants/estados.js';

export default function StateBadge({ estado, size = 'sm' }) {
  if (!estado) return null;
  const tone = COLOR_ESTADO[estado] || 'neutral';
  return (
    <span className={`badge badge--${tone} badge--${size}`} title={estado}>
      {estado}
    </span>
  );
}
