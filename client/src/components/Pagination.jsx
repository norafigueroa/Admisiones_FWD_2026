export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const prev = () => onChange(Math.max(1, page - 1));
  const next = () => onChange(Math.min(totalPages, page + 1));
  return (
    <div className="pagination">
      <button onClick={prev} disabled={page <= 1}>← Anterior</button>
      <span className="muted">Página {page} de {totalPages}</span>
      <button onClick={next} disabled={page >= totalPages}>Siguiente →</button>
    </div>
  );
}
