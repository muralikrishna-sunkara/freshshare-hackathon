export function Stars({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return <span className="text-xs text-stone-500">New, no ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm" aria-label={`Rated ${avg} out of 5 from ${count} ratings`}>
      <span className="text-accent">★</span>
      <span className="font-semibold">{avg.toFixed(1)}</span>
      <span className="text-stone-500">({count})</span>
    </span>
  );
}
