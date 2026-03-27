type StatusBadgeProps = {
  status?: string | null;
  size?: 'sm' | 'md';
};

type StatusConfig = {
  bg: string;
  label: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  NEW: { bg: 'bg-gray-700 text-gray-100', label: 'New' },
  INGESTED: { bg: 'bg-slate-800 text-slate-100', label: 'Ingested' },
  NORMALIZED: { bg: 'bg-sky-900 text-sky-100', label: 'Normalized' },
  SCORED: { bg: 'bg-blue-900 text-blue-100', label: 'Scored' },
  READY: { bg: 'bg-green-900 text-green-100', label: 'Ready' },
  REVIEWING: { bg: 'bg-purple-900 text-purple-100', label: 'Reviewing' },
  REVIEW_OPENED: { bg: 'bg-cyan-900 text-cyan-100', label: 'Review Opened' },
  APPLIED: { bg: 'bg-indigo-900 text-indigo-100', label: 'Applied' },
  SKIPPED: { bg: 'bg-gray-800 text-gray-300', label: 'Skipped' },
  FOLLOW_UP: { bg: 'bg-orange-900 text-orange-100', label: 'Follow-up' },
  ARCHIVED: { bg: 'bg-gray-900 text-gray-400', label: 'Archived' },
  APPLY_FAILED: { bg: 'bg-red-900 text-red-100', label: 'Apply Failed' },
  UNKNOWN: { bg: 'bg-gray-800 text-gray-200', label: 'Unknown' },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  bg: 'bg-gray-800 text-gray-200',
  label: 'Unknown',
};

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function StatusBadge({
  status,
  size = 'md',
}: StatusBadgeProps) {
  const normalizedStatus =
    typeof status === 'string' && status.trim()
      ? status.trim().toUpperCase()
      : 'UNKNOWN';

  const config = STATUS_CONFIG[normalizedStatus] ?? {
    ...DEFAULT_STATUS_CONFIG,
    label:
      normalizedStatus === 'UNKNOWN'
        ? DEFAULT_STATUS_CONFIG.label
        : formatStatusLabel(normalizedStatus),
  };

  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`badge ${config.bg} ${sizeClass}`}>
      {config.label}
    </span>
  );
}
