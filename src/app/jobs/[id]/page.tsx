'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ScoreBadge from '@/components/ScoreBadge';
import StatusBadge from '@/components/StatusBadge';
import ApplyButton from '@/components/ApplyButton';
import ReviewPacketPanel from '@/components/ReviewPacketPanel';

interface ScoreDimension {
  name: string;
  score: number;
  maxScore: number;
}

interface ReviewPacket {
  id: string;
  jobId: string;
  resumeEmphasis?: string[];
  summaryRewrite?: string;
  keyBullets?: string[];
  whyApply?: string;
  risks?: string[];
  interviewPrep?: string[];
  outreachDraft?: string;
  sponsorNotes?: string;
}

interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  workplaceType?: string;
  sourceUrl?: string;
  source?: string;
  status: string;
  fitScore?: number | null;
  roleFamily?: string | null;
  roleFamilyConfidence?: number | null;
  priorityScore?: number | null;
  positionabilityScore?: number | null;
  riskLevel?: string | null;
  riskFlags?: string[];
  pursuitRecommendation?: string | null;
  recommendationLabel?: string | null;
  decisionState?: string | null;
  queuePriorityScore?: number | null;
  scoreDimensions?: ScoreDimension[];
  scoreRationale?: string | null;
  strategicRationale?: string | null;
  positionabilityNote?: string | null;
  matchedSkills?: string[];
  missingSkills?: string[];
  matchedCoreSkills?: string[];
  missingCoreSkills?: string[];
  missingSecondarySkills?: string[];
  incidentalMismatches?: string[];
  keywordGaps?: string[];
  relevantProjects?: string[];
  scoreRisks?: string[];
  sponsorshipNotes?: string;
  cleanedJD?: string;
  rawJD?: string;
  requirements?: string[];
  adapterId?: string | null;
  reviewPacket?: ReviewPacket | null;
}

const WORKFLOW_STATUS_OPTIONS = [
  'NEW',
  'INGESTED',
  'NORMALIZED',
  'SCORED',
  'READY',
  'REVIEWING',
  'REVIEW_OPENED',
  'APPLIED',
  'FOLLOW_UP',
  'SKIPPED',
  'ARCHIVED',
  'APPLY_FAILED',
] as const;

const WORKFLOW_STATUS_LABELS: Record<(typeof WORKFLOW_STATUS_OPTIONS)[number], string> = {
  NEW: 'New',
  INGESTED: 'Ingested',
  NORMALIZED: 'Normalized',
  SCORED: 'Scored',
  READY: 'Ready',
  REVIEWING: 'Reviewing',
  REVIEW_OPENED: 'Review Opened',
  APPLIED: 'Applied',
  FOLLOW_UP: 'Follow Up',
  SKIPPED: 'Skipped',
  ARCHIVED: 'Archived',
  APPLY_FAILED: 'Apply Failed',
};

export default function JobDetail() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packetLoading, setPacketLoading] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const fetchJob = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) throw new Error('Failed to fetch job');
        const data = await response.json();
        setJob(data.job || data.data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;

    try {
      setStatusSaving(true);
      setStatusMessage(null);
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update status');
      }
      setJob(data.job || data.data || null);
      setStatusMessage(`Workflow status updated to ${newStatus.replace(/_/g, ' ')}.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Failed to update workflow status.',
      );
      console.error('Error updating status:', err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleGeneratePacket = async () => {
    if (!job) return;

    try {
      setPacketLoading(true);
      setPacketError(null);
      const response = await fetch(`/api/jobs/${job.id}/packet`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to generate packet');
      }
      setJob(data.job || data.data?.job || data.data || null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error generating packet';
      setPacketError(message);
      console.error('Error generating packet:', err);
    } finally {
      setPacketLoading(false);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!job) return;

    try {
      const response = await fetch(`/api/jobs/${job.id}/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          action: 'Follow up on application',
          notes: 'Created from job detail quick action',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to create follow-up');
      }

      setJob(data.job || data.data?.job || null);
    } catch (err) {
      console.error('Error creating follow-up:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900 border border-red-800 text-red-100 p-6 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error Loading Job</h2>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="btn btn-secondary mt-4"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <p className="text-gray-400">Job not found</p>
          <button
            onClick={() => router.back()}
            className="btn btn-secondary mt-4"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-200 text-2xl"
        >
          ←
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{job.title}</h1>
          <p className="text-gray-400">{job.company}</p>
        </div>
        <StatusBadge status={job.status as any} size="md" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left column (60%) */}
        <div className="col-span-2 space-y-6">
          {/* Job Header Card */}
          <div className="card space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Job Details</h3>
                <div className="space-y-3">
                  {job.location && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Location</p>
                      <p className="text-gray-100">{job.location}</p>
                    </div>
                  )}
                  {job.salary && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Salary</p>
                      <p className="text-gray-100">{job.salary}</p>
                    </div>
                  )}
                  {job.workplaceType && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Workplace Type</p>
                      <p className="text-gray-100">{job.workplaceType}</p>
                    </div>
                  )}
                  {job.source && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Source</p>
                      <p className="text-gray-100">{job.source}</p>
                    </div>
                  )}
                  {job.roleFamily && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Role Family</p>
                      <p className="text-gray-100">{job.roleFamily}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Workflow Status</p>
                    <p className="text-gray-100">{job.status.replace(/_/g, ' ')}</p>
                  </div>
                  {job.recommendationLabel && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Recommendation</p>
                      <p className="text-gray-100">{job.recommendationLabel}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Score */}
              {job.fitScore !== null && job.fitScore !== undefined && (
                <div className="space-y-4 min-w-[180px]">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase mb-2">Fit Score</p>
                    <ScoreBadge score={job.fitScore} size="lg" />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {job.priorityScore !== null && job.priorityScore !== undefined && (
                      <div className="card-compact">
                        <p className="text-xs text-gray-500 uppercase mb-1">Priority</p>
                        <p className="text-lg font-semibold text-white">{Math.round(job.priorityScore)}/100</p>
                      </div>
                    )}
                    {job.positionabilityScore !== null && job.positionabilityScore !== undefined && (
                      <div className="card-compact">
                        <p className="text-xs text-gray-500 uppercase mb-1">Positionability</p>
                        <p className="text-lg font-semibold text-white">{Math.round(job.positionabilityScore)}/100</p>
                      </div>
                    )}
                    {job.riskLevel && (
                      <div className="card-compact">
                        <p className="text-xs text-gray-500 uppercase mb-1">Risk Level</p>
                        <p className="text-sm font-semibold text-white">{job.riskLevel}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Source link */}
            {job.sourceUrl && (
              <div className="pt-4 border-t border-gray-800">
                <a
                  href={job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-400 text-sm font-medium flex items-center gap-2"
                >
                  🔗 View Original Posting
                </a>
              </div>
            )}
          </div>

          {/* Score Breakdown */}
          {job.scoreDimensions && job.scoreDimensions.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Score Breakdown</h3>
              <div className="space-y-4">
                {job.scoreDimensions.map((dimension, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        {dimension.name}
                      </label>
                      <span className="text-sm font-semibold text-gray-100">
                        {dimension.score}/{dimension.maxScore}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(dimension.score / dimension.maxScore) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(job.scoreRationale ||
            job.pursuitRecommendation ||
            job.positionabilityNote ||
            (job.riskFlags && job.riskFlags.length > 0) ||
            (job.matchedCoreSkills && job.matchedCoreSkills.length > 0) ||
            (job.missingCoreSkills && job.missingCoreSkills.length > 0) ||
            (job.missingSecondarySkills && job.missingSecondarySkills.length > 0) ||
            (job.incidentalMismatches && job.incidentalMismatches.length > 0) ||
            (job.relevantProjects && job.relevantProjects.length > 0) ||
            (job.scoreRisks && job.scoreRisks.length > 0)) && (
            <div className="card space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">Score Explanation</h3>
                <p className="text-sm text-gray-300">
                  {job.scoreRationale || 'This score was calculated from the saved candidate profile and job description.'}
                </p>
              </div>

              {job.pursuitRecommendation && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Recommendation</p>
                  <p className="text-sm text-gray-100">
                    {job.recommendationLabel || job.pursuitRecommendation.replace(/_/g, ' ')}
                  </p>
                </div>
              )}

              {job.positionabilityNote && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Positionability</p>
                  <p className="text-sm text-gray-300">{job.positionabilityNote}</p>
                </div>
              )}

              {job.riskFlags && job.riskFlags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Risk Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {job.riskFlags.map((flag) => (
                      <span key={flag} className="badge bg-red-900 text-red-100">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.matchedCoreSkills && job.matchedCoreSkills.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Matched Core Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {job.matchedCoreSkills.map((skill) => (
                      <span key={skill} className="badge bg-green-900 text-green-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.missingCoreSkills && job.missingCoreSkills.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Missing Core Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {job.missingCoreSkills.map((skill) => (
                      <span key={skill} className="badge bg-yellow-900 text-yellow-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.missingSecondarySkills && job.missingSecondarySkills.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Missing Secondary Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {job.missingSecondarySkills.map((skill) => (
                      <span key={skill} className="badge bg-blue-900 text-blue-100">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.incidentalMismatches && job.incidentalMismatches.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Incidental Stack Mismatches</p>
                  <ul className="space-y-2">
                    {job.incidentalMismatches.map((gap) => (
                      <li key={gap} className="text-sm text-gray-300">
                        • {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.keywordGaps && job.keywordGaps.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Keyword Gaps</p>
                  <ul className="space-y-2">
                    {job.keywordGaps.map((gap) => (
                      <li key={gap} className="text-sm text-gray-300">
                        • {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.relevantProjects && job.relevantProjects.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Relevant Projects</p>
                  <ul className="space-y-2">
                    {job.relevantProjects.map((project) => (
                      <li key={project} className="text-sm text-gray-300">
                        • {project}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {job.scoreRisks && job.scoreRisks.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Risks</p>
                  <ul className="space-y-2">
                    {job.scoreRisks.map((risk) => (
                      <li key={risk} className="text-sm text-gray-300">
                        • {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Sponsorship Notes */}
          {job.sponsorshipNotes && (
            <div className="card bg-orange-950 border border-orange-800">
              <h3 className="text-sm font-semibold text-orange-100 mb-2">Sponsorship Notes</h3>
              <p className="text-orange-100 text-sm">{job.sponsorshipNotes}</p>
            </div>
          )}

          {/* Job Description */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Job Description</h3>
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                {job.cleanedJD || job.rawJD || 'No description available'}
              </div>
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && job.requirements.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Requirements</h3>
              <ul className="space-y-2">
                {job.requirements.map((req, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-300 text-sm">
                    <span className="text-green-500 flex-shrink-0">✓</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right column (40%) */}
        <div className="col-span-1 space-y-6 flex flex-col">
          {/* Review Packet Panel */}
          <ReviewPacketPanel
            packet={job.reviewPacket}
            loading={packetLoading}
            error={packetError}
            onGenerate={handleGeneratePacket}
          />

          {/* Generate Packet Button */}
          {!job.reviewPacket && !packetLoading && (
            <button
              onClick={handleGeneratePacket}
              className="btn btn-primary w-full"
            >
              📝 Generate Packet
            </button>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <div className="card-compact space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-2">Workflow Status</p>
                <select
                  value={job.status}
                  onChange={(event) => handleStatusChange(event.target.value)}
                  disabled={statusSaving}
                  className="input w-full"
                >
                  {WORKFLOW_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {WORKFLOW_STATUS_LABELS[statusOption]}
                    </option>
                  ))}
                </select>
              </div>
              {statusMessage && (
                <p className="text-xs text-gray-400">{statusMessage}</p>
              )}
            </div>

            <ApplyButton
              jobId={job.id}
              status={job.status}
              sourceUrl={job.sourceUrl}
              adapterId={job.adapterId}
              onApplied={(updatedJob) => setJob(updatedJob)}
            />

            {job.sourceUrl && (
              <button
                onClick={() => window.open(job.sourceUrl, '_blank')}
                className="btn btn-secondary w-full"
              >
                🔗 Open Posting
              </button>
            )}

            {!['APPLIED', 'FOLLOW_UP', 'SKIPPED', 'ARCHIVED'].includes(job.status) && (
              <button
                onClick={() => handleStatusChange('READY')}
                className="btn btn-secondary w-full"
              >
                ⏸ Save for Later
              </button>
            )}

            {!['APPLIED', 'FOLLOW_UP', 'SKIPPED', 'ARCHIVED'].includes(job.status) && (
              <button
                onClick={() => handleStatusChange('APPLIED')}
                className="btn btn-secondary w-full"
              >
                ✓ Mark Applied
              </button>
            )}

            {!['APPLIED', 'SKIPPED', 'ARCHIVED'].includes(job.status) && (
              <button
                onClick={() => handleStatusChange('SKIPPED')}
                className="btn btn-ghost w-full"
              >
                ⊘ Skip
              </button>
            )}

            {job.status !== 'FOLLOW_UP' && ['APPLIED', 'REVIEW_OPENED'].includes(job.status) && (
              <button
                onClick={handleCreateFollowUp}
                className="btn btn-secondary w-full"
              >
                🔔 Set Follow-up
              </button>
            )}

            {job.status !== 'ARCHIVED' && (
              <button
                onClick={() => handleStatusChange('ARCHIVED')}
                className="btn btn-ghost w-full"
              >
                Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
