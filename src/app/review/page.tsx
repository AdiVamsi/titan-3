'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ScoreBadge from '@/components/ScoreBadge';
import StatusBadge from '@/components/StatusBadge';

interface Job {
  id: string;
  title: string;
  company: string;
  fitScore?: number | null;
  status: string;
  roleFamily?: string | null;
  priorityScore?: number | null;
  positionabilityScore?: number | null;
  riskLevel?: string | null;
  riskFlags?: string[];
  pursuitRecommendation?: string | null;
  recommendationLabel?: string | null;
  decisionState?: string | null;
  queuePriorityScore?: number | null;
  sponsorshipRisk?: 'SAFE' | 'LIKELY_SAFE' | 'UNCERTAIN' | 'RISKY' | 'BLOCKED';
}

function sortReviewJobs(items: Job[]) {
  return [...items].sort((left, right) => {
    const queuePriorityDelta =
      (right.queuePriorityScore || 0) - (left.queuePriorityScore || 0);
    if (queuePriorityDelta !== 0) return queuePriorityDelta;

    const priorityDelta = (right.priorityScore || 0) - (left.priorityScore || 0);
    if (priorityDelta !== 0) return priorityDelta;

    const positionabilityDelta =
      (right.positionabilityScore || 0) - (left.positionabilityScore || 0);
    if (positionabilityDelta !== 0) return positionabilityDelta;

    return (right.fitScore || 0) - (left.fitScore || 0);
  });
}

export default function ReviewQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          '/api/jobs?status=SCORED,READY,REVIEWING&sort=priorityScore&order=desc'
        );
        if (!response.ok) throw new Error('Failed to fetch jobs');
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        setJobs(sortReviewJobs(items));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const handleStatusUpdate = async (jobId: string, status: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error(`Failed to set status to ${status}`);

      const data = await response.json();
      const updatedJob = data.job || data.data || null;

      setJobs((currentJobs) => {
        if (!updatedJob) return currentJobs;
        const nextJobs = currentJobs
          .map((job) => (job.id === jobId ? updatedJob : job))
          .filter((job) => !['SKIPPED', 'APPLIED', 'FOLLOW_UP', 'ARCHIVED'].includes(job.status));
        return sortReviewJobs(nextJobs);
      });
    } catch (err) {
      console.error('Error updating job status:', err);
    }
  };

  const getSponsorshipColor = (risk?: string) => {
    switch (risk) {
      case 'SAFE':
        return 'text-green-400';
      case 'LIKELY_SAFE':
        return 'text-yellow-400';
      case 'UNCERTAIN':
        return 'text-orange-400';
      case 'RISKY':
      case 'BLOCKED':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getRiskBadgeClass = (riskLevel?: string | null) => {
    switch ((riskLevel || '').toUpperCase()) {
      case 'LOW':
        return 'bg-green-900 text-green-100';
      case 'MEDIUM':
        return 'bg-yellow-900 text-yellow-100';
      case 'HIGH':
        return 'bg-red-900 text-red-100';
      default:
        return 'bg-gray-800 text-gray-200';
    }
  };

  const getRecommendationBadgeClass = (decisionState?: string | null) => {
    switch (decisionState) {
      case 'STRONG_FIT':
        return 'bg-green-900 text-green-100';
      case 'GOOD_ADJACENT_FIT':
        return 'bg-blue-900 text-blue-100';
      case 'STRETCH':
        return 'bg-yellow-900 text-yellow-100';
      case 'SKIP':
        return 'bg-gray-800 text-gray-200';
      default:
        return 'bg-gray-800 text-gray-200';
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900 border border-red-800 text-red-100 p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error Loading Review Queue</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Review Queue</h1>
        <p className="text-gray-400">Jobs ready for your review and action</p>
      </div>

      {/* Queue list */}
      <div className="space-y-2">
        {loading ? (
          <div className="card p-8 text-center">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            <p className="text-gray-400">Loading review queue...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-gray-400">✓ No jobs waiting for review!</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="card-compact border border-gray-800 hover:border-gray-700 flex items-center justify-between"
            >
              <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                {/* Score */}
                <div className="col-span-1">
                  <ScoreBadge score={job.fitScore} size="sm" />
                </div>

                {/* Title & Company */}
                <div className="col-span-4">
                  <p className="font-semibold text-gray-100">{job.title}</p>
                  <p className="text-sm text-gray-500">{job.company}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {job.roleFamily && (
                      <span className="badge bg-gray-800 text-gray-100">
                        {job.roleFamily}
                      </span>
                    )}
                    {job.recommendationLabel && (
                      <span className={`badge ${getRecommendationBadgeClass(job.decisionState)}`}>
                        {job.recommendationLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recommendation / Risk */}
                <div className="col-span-2 space-y-2">
                  <p className="text-sm font-medium text-gray-100">
                    {job.recommendationLabel || 'Needs Review'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.riskLevel && (
                      <span className={`badge ${getRiskBadgeClass(job.riskLevel)}`}>
                        Risk {job.riskLevel}
                      </span>
                    )}
                    <span className={`text-xs font-medium ${getSponsorshipColor(job.sponsorshipRisk)}`}>
                      Sponsorship {job.sponsorshipRisk || 'UNCERTAIN'}
                    </span>
                    {(job.riskFlags || []).slice(0, 1).map((flag) => (
                      <span key={flag} className="badge bg-red-900 text-red-100">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <div className="space-y-2">
                    <StatusBadge status={job.status as any} size="sm" />
                    <p className="text-xs text-gray-500">
                      Priority {Math.round(job.priorityScore || 0)} / Positionability {Math.round(job.positionabilityScore || 0)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-3 flex justify-end gap-2 flex-wrap">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="btn btn-sm btn-primary"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleStatusUpdate(job.id, 'READY')}
                    className="btn btn-sm btn-ghost"
                  >
                    Later
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(job.id, 'APPLIED')}
                    className="btn btn-sm btn-secondary"
                  >
                    Applied
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(job.id, 'SKIPPED')}
                    className="btn btn-sm btn-secondary"
                  >
                    Skip
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
