'use client';

import { useState } from 'react';

interface ApplyButtonProps {
  jobId: string;
  status: string;
  sourceUrl?: string;
  adapterId?: string | null;
  canApply?: boolean;
  canPrefill?: boolean;
  onApplied?: (job: any) => void;
}

export default function ApplyButton({
  jobId,
  status,
  sourceUrl,
  adapterId,
  canApply = true,
  canPrefill = false,
  onApplied,
}: ApplyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isEnabled = canApply && ['READY', 'REVIEWING'].includes(status);

  const handleApply = async () => {
    if (!isEnabled) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          message: data.error || data.message || 'Failed to apply',
        });
        return;
      }

      setResult({
        success: true,
        message: data.message || 'Application submitted successfully',
      });

      if (data.job || data.data?.job) {
        onApplied?.(data.job || data.data?.job);
      }

      // If manual open, open the URL
      const method = data.method || data.data?.result?.method;
      if (method === 'MANUAL_OPEN' && sourceUrl) {
        window.open(sourceUrl, '_blank');
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Error submitting application',
      });
    } finally {
      setLoading(false);
    }
  };

  let buttonLabel = 'Apply';
  if (canPrefill) {
    buttonLabel = 'Open & Prefill';
  } else if (!adapterId) {
    buttonLabel = 'Open Posting';
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleApply}
        disabled={!isEnabled || loading}
        className="btn btn-primary w-full"
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span>
            Applying...
          </>
        ) : (
          buttonLabel
        )}
      </button>

      {result && (
        <div
          className={`p-3 rounded-lg text-sm ${
            result.success
              ? 'bg-green-900 text-green-100 border border-green-800'
              : 'bg-red-900 text-red-100 border border-red-800'
          }`}
        >
          {result.message}
        </div>
      )}

      {!isEnabled && (
        <p className="text-xs text-gray-500">
          Job status must be Ready or Reviewing to apply
        </p>
      )}
    </div>
  );
}
