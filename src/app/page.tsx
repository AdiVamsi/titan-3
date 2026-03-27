'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ScoreBadge from '@/components/ScoreBadge';
import StatusBadge from '@/components/StatusBadge';

interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  source?: string;
  sourceUrl?: string;
  fitScore?: number | null;
  status: string;
  roleFamily?: string | null;
  riskLevel?: string | null;
  riskFlags?: string[];
  recommendationLabel?: string | null;
  decisionState?: string | null;
  priorityScore?: number | null;
  createdAt: string;
}

interface Stats {
  newToday: number;
  highFit: number;
  readyToReview: number;
  applied: number;
  followUpsDue: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    newToday: 0,
    highFit: 0,
    readyToReview: 0,
    applied: 0,
    followUpsDue: 0,
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch jobs
        const jobsRes = await fetch('/api/jobs?limit=50');
        if (!jobsRes.ok) throw new Error('Failed to fetch jobs');
        const jobsData = await jobsRes.json();
        const items = Array.isArray(jobsData.items) ? jobsData.items : [];
        setJobs(items);

        // Calculate stats
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const newToday = items.filter((j: Job) => {
          const createdDate = new Date(j.createdAt);
          return createdDate >= today;
        }).length;

        const highFit = items.filter((j: Job) => (j.fitScore || 0) >= 75).length;
        const readyToReview = items.filter((j: Job) =>
          ['SCORED', 'READY', 'REVIEWING'].includes(j.status) &&
          ['STRONG_FIT', 'GOOD_ADJACENT_FIT', 'STRETCH'].includes(j.decisionState || '')
        ).length;
        const applied = items.filter((j: Job) => j.status === 'APPLIED').length;
        const followUpsDue = items.filter((j: Job) => j.status === 'FOLLOW_UP').length;

        setStats({
          newToday,
          highFit,
          readyToReview,
          applied,
          followUpsDue,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900 border border-red-800 text-red-100 p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error Loading Dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Job hunting automation overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="New Today" value={stats.newToday} color="blue" loading={loading} />
        <StatCard label="High Fit" value={stats.highFit} color="green" loading={loading} />
        <StatCard label="Ready to Review" value={stats.readyToReview} color="purple" loading={loading} />
        <StatCard label="Applied" value={stats.applied} color="indigo" loading={loading} />
        <StatCard label="Follow-ups Due" value={stats.followUpsDue} color="orange" loading={loading} />
      </div>

      {/* Jobs Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Recent Jobs</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            <p className="text-gray-400">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 mb-4">No jobs yet. Click "Ingest Job" to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900 border-b border-gray-800">
                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="table-row-hover"
                  >
                    <td className="px-6 py-4">
                      <ScoreBadge score={job.fitScore} size="sm" />
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-100 truncate">{job.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {job.roleFamily || 'Role family pending'}
                      </p>
                      {job.recommendationLabel && (
                        <p className="text-xs text-blue-300 truncate mt-1">
                          {job.recommendationLabel}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-300">{job.company}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm">{job.location || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-400 text-sm">{job.source || '—'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <StatusBadge status={job.status as any} size="sm" />
                        {(job.riskLevel || (job.riskFlags && job.riskFlags.length > 0)) && (
                          <p className="text-xs text-gray-500">
                            {[job.riskLevel ? `Risk ${job.riskLevel}` : null, job.riskFlags?.[0] || null]
                              .filter(Boolean)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="btn btn-sm btn-ghost"
                      >
                        View
                      </Link>
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

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'indigo' | 'orange';
  loading: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-900 text-blue-100 border-blue-800',
    green: 'bg-green-900 text-green-100 border-green-800',
    purple: 'bg-purple-900 text-purple-100 border-purple-800',
    indigo: 'bg-indigo-900 text-indigo-100 border-indigo-800',
    orange: 'bg-orange-900 text-orange-100 border-orange-800',
  };

  return (
    <div className={`card border ${colorClasses[color]}`}>
      <div className="text-sm text-opacity-80">{label}</div>
      <div className="text-3xl font-bold mt-2">
        {loading ? (
          <span className="text-gray-500">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
