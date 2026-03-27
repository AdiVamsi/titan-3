interface ScoreBadgeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className="badge badge-neutral">
        —
      </span>
    );
  }

  let bgClass = 'bg-red-900 text-red-100';
  if (score >= 75) {
    bgClass = 'bg-green-900 text-green-100';
  } else if (score >= 50) {
    bgClass = 'bg-yellow-900 text-yellow-100';
  }

  const sizeClass =
    size === 'sm' ? 'px-2 py-1 text-xs' :
    size === 'lg' ? 'px-4 py-2 text-base' :
    'px-3 py-1 text-sm';

  return (
    <span className={`badge ${bgClass} ${sizeClass} font-bold`}>
      {score}%
    </span>
  );
}
