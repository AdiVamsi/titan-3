'use client';

import { useEffect, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';

interface Job {
  id: string;
  title: string;
  company: string;
  status: string;
  roleFamily?: string | null;
  recommendationLabel?: string | null;
  riskLevel?: string | null;
  appliedDate?: string;
  appliedMethod?: string;
  followUpDate?: string;
  notes?: string;
}

export default function Tracker() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          '/api/jobs?status=APPLIED,FOLLOW_UP,REVIEW_OPENED&sort=appliedDate&order=desc'
        );
        if (!response.ok) throw new Error('Failed to fetch jobs');
        const data = await response.json();
        setJobs(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleSaveNotes = async (jobId: string, notes: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) throw new Error('Failed to save notes');

      setJobs(
        jobs.map((j) =>
          j.id === jobId ? { ...j, notes } : j
        )
      );
      setEditingId(null);
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  const handleArchive = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });

      if (!response.ok) throw new Error('Failed to archive job');
      setJobs(jobs.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error('Error archiving job:', err);
    }
  };

  const handleSetFollowUp = async (jobId: string) => {
    try {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch(`/api/jobs/${jobId}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate,
          action: 'Follow up on application',
          notes: 'Created from tracker quick action',
        }),
      });

      if (!response.ok) throw new Error('Failed to create follow-up');

      const data = await response.json();
      const updatedJob = data.job || data.data?.job || null;
      if (!updatedJob) return;

      setJobs((currentJobs) =>
        currentJobs.map((job) => (job.id === jobId ? updatedJob : job))
      );
    } catch (err) {
      console.error('Error creating follow-up:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const getMethodBadgeColor = (method?: string) => {
    switch (method) {
      case 'MANUAL_OPEN':
        return 'bg-gray-700 text-gray-100';
      case 'BROWSER_PREFILL':
        return 'bg-blue-700 text-blue-100';
      case 'ADAPTER_SUBMIT':
        return 'bg-green-700 text-green-100';
      default:
        return 'bg-gray-700 text-gray-100';
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900 border border-red-800 text-red-100 p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error Loading Tracker</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Applications Tracker</h1>
        <p className="text-gray-400">Track your submitted applications and follow-ups</p>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            <p className="text-gray-400">Loading applications...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">No tracked applications yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Applied Date</th>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Follow-up</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-100 truncate max-w-xs">
                        {job.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                        {job.roleFamily || 'Role family pending'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{job.company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm">
                        {formatDate(job.appliedDate)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${getMethodBadgeColor(
                          job.appliedMethod
                        )}`}
                      >
                        {job.appliedMethod === 'MANUAL_OPEN'
                          ? 'Manual'
                          : job.appliedMethod === 'BROWSER_PREFILL'
                          ? 'Prefill'
                          : job.appliedMethod === 'ADAPTER_SUBMIT'
                          ? 'Auto'
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <StatusBadge status={job.status as any} size="sm" />
                        {(job.recommendationLabel || job.riskLevel) && (
                          <p className="text-xs text-gray-500 max-w-xs">
                            {[job.recommendationLabel, job.riskLevel ? `Risk ${job.riskLevel}` : null]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm">
                        {formatDate(job.followUpDate)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {editingId === job.id ? (
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="input text-sm w-40"
                          autoFocus
                          onBlur={() =>
                            handleSaveNotes(job.id, editNotes)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveNotes(job.id, editNotes);
                            }
                          }}
                        />
                      ) : (
                        <p
                          onClick={() => {
                            setEditingId(job.id);
                            setEditNotes(job.notes || '');
                          }}
                          className="text-gray-400 text-sm cursor-pointer hover:text-gray-300 truncate max-w-xs"
                        >
                          {job.notes || '—'}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap">
                        {job.status !== 'FOLLOW_UP' && (
                          <button
                            onClick={() => handleSetFollowUp(job.id)}
                            className="btn btn-sm btn-secondary"
                          >
                            Follow-up
                          </button>
                        )}
                        <button
                          onClick={() => handleArchive(job.id)}
                          className="btn btn-sm btn-ghost"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
