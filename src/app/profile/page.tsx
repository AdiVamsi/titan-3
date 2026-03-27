'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type ProfileResponse = {
  profile?: {
    fullName?: string | null;
    headline?: string | null;
    summary?: string | null;
    currentRole?: string | null;
    experienceYears?: number;
    skills?: string[];
    projects?: string[];
    targetTitles?: string[];
    preferredLocations?: string[];
    remotePreference?: string | null;
    workAuth?: string;
    rawResumeText?: string | null;
    notes?: string | null;
  };
  usingFallback?: boolean;
  message?: string;
  error?: string;
};

type ProfileFormState = {
  fullName: string;
  headline: string;
  summary: string;
  currentRole: string;
  yearsExperience: string;
  skillsText: string;
  projectsText: string;
  targetRolesText: string;
  preferredLocationsText: string;
  remotePreference: string;
  workAuthorizationNote: string;
  rawResumeText: string;
  notes: string;
};

const EMPTY_FORM: ProfileFormState = {
  fullName: '',
  headline: '',
  summary: '',
  currentRole: '',
  yearsExperience: '',
  skillsText: '',
  projectsText: '',
  targetRolesText: '',
  preferredLocationsText: '',
  remotePreference: '',
  workAuthorizationNote: '',
  rawResumeText: '',
  notes: '',
};

function arrayToLines(values?: string[] | null) {
  return Array.isArray(values) ? values.join('\n') : '';
}

function parseLines(value: string) {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}

function buildForm(profile?: ProfileResponse['profile']): ProfileFormState {
  if (!profile) {
    return EMPTY_FORM;
  }

  return {
    fullName: profile.fullName || '',
    headline: profile.headline || '',
    summary: profile.summary || '',
    currentRole: profile.currentRole || '',
    yearsExperience:
      typeof profile.experienceYears === 'number'
        ? String(profile.experienceYears)
        : '',
    skillsText: arrayToLines(profile.skills),
    projectsText: arrayToLines(profile.projects),
    targetRolesText: arrayToLines(profile.targetTitles),
    preferredLocationsText: arrayToLines(profile.preferredLocations),
    remotePreference: profile.remotePreference || '',
    workAuthorizationNote: profile.workAuth || '',
    rawResumeText: profile.rawResumeText || '',
    notes: profile.notes || '',
  };
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/profile');
        const data: ProfileResponse = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load profile');
        }

        setUsingFallback(Boolean(data.usingFallback));
        setForm(buildForm(data.profile));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const profileSummary = useMemo(() => {
    const skillsCount = parseLines(form.skillsText).length;
    const projectsCount = parseLines(form.projectsText).length;
    const targetsCount = parseLines(form.targetRolesText).length;

    return `${skillsCount} skills, ${projectsCount} projects, ${targetsCount} target roles`;
  }, [form.skillsText, form.projectsText, form.targetRolesText]);

  const updateField = <K extends keyof ProfileFormState,>(
    key: K,
    value: ProfileFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleTextUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      updateField('rawResumeText', text);
      setMessage(`Loaded ${file.name} into the resume text box.`);
      setError(null);
    } catch {
      setError('Failed to read the selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleExtract = async () => {
    if (!form.rawResumeText.trim()) {
      setError('Paste resume text or upload a plain text file first.');
      return;
    }

    try {
      setExtracting(true);
      setError(null);
      setMessage(null);

      const response = await fetch('/api/profile/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: form.rawResumeText,
        }),
      });
      const data: ProfileResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract profile');
      }

      setUsingFallback(false);
      setForm(buildForm(data.profile));
      setMessage(data.message || 'Profile extracted successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract profile');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName || null,
          headline: form.headline || null,
          summary: form.summary || null,
          currentRole: form.currentRole || null,
          yearsExperience: form.yearsExperience || undefined,
          skills: parseLines(form.skillsText),
          projects: parseLines(form.projectsText),
          targetRoles: parseLines(form.targetRolesText),
          preferredLocations: parseLines(form.preferredLocationsText),
          remotePreference: form.remotePreference || null,
          workAuthorizationNote: form.workAuthorizationNote || undefined,
          rawResumeText: form.rawResumeText || null,
          notes: form.notes || null,
        }),
      });
      const data: ProfileResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setUsingFallback(false);
      setForm(buildForm(data.profile));
      setMessage(data.message || 'Profile saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRescore = async () => {
    try {
      setRescoring(true);
      setError(null);
      setMessage(null);

      const response = await fetch('/api/profile/rescore', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rescore jobs');
      }

      setMessage(data.message || 'Jobs rescored successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rescore jobs');
    } finally {
      setRescoring(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="card p-12 text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Candidate Profile</h1>
          <p className="text-gray-400 mt-2 max-w-3xl">
            Save the resume-backed profile Titan-3 should use for scoring.
            Paste resume text or upload a plain text file, extract the fields,
            then rescore existing jobs against the saved profile.
          </p>
        </div>
        <div className="card-compact min-w-[220px]">
          <p className="text-xs text-gray-500 uppercase mb-2">Current Profile</p>
          <p className="text-sm text-gray-100">{profileSummary}</p>
          <p className="text-xs text-gray-400 mt-2">
            {usingFallback
              ? 'Using fallback scoring profile until you save one.'
              : 'Saved profile is active for new scoring runs.'}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-800 text-red-100 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-900 border border-green-800 text-green-100 p-4 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Resume Text</h2>
                <p className="text-sm text-gray-400 mt-1">
                  MVP input is text-first. Upload a plain text resume file or paste the extracted text here.
                </p>
              </div>
              <label className="btn btn-secondary cursor-pointer">
                Upload .txt
                <input
                  type="file"
                  accept=".txt,.text,.md"
                  className="hidden"
                  onChange={handleTextUpload}
                />
              </label>
            </div>

            <textarea
              value={form.rawResumeText}
              onChange={(event) => updateField('rawResumeText', event.target.value)}
              rows={18}
              className="input w-full"
              placeholder="Paste resume text here"
            />

            <div className="flex gap-3">
              <button
                onClick={handleExtract}
                className="btn btn-primary"
                disabled={extracting}
              >
                {extracting ? 'Extracting...' : 'Extract Profile'}
              </button>
              <button
                onClick={handleRescore}
                className="btn btn-secondary"
                disabled={rescoring}
              >
                {rescoring ? 'Rescoring...' : 'Rescore Jobs'}
              </button>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-100">Extracted Profile</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Full Name</label>
                <input
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Current Role</label>
                <input
                  value={form.currentRole}
                  onChange={(event) => updateField('currentRole', event.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 uppercase mb-2 block">Headline</label>
                <input
                  value={form.headline}
                  onChange={(event) => updateField('headline', event.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Years Experience</label>
                <input
                  value={form.yearsExperience}
                  onChange={(event) => updateField('yearsExperience', event.target.value)}
                  type="number"
                  min="0"
                  step="0.5"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Remote Preference</label>
                <input
                  value={form.remotePreference}
                  onChange={(event) => updateField('remotePreference', event.target.value)}
                  className="input w-full"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 uppercase mb-2 block">Summary</label>
                <textarea
                  value={form.summary}
                  onChange={(event) => updateField('summary', event.target.value)}
                  rows={5}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Skills</label>
                <textarea
                  value={form.skillsText}
                  onChange={(event) => updateField('skillsText', event.target.value)}
                  rows={10}
                  className="input w-full"
                  placeholder="One skill per line"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Projects</label>
                <textarea
                  value={form.projectsText}
                  onChange={(event) => updateField('projectsText', event.target.value)}
                  rows={10}
                  className="input w-full"
                  placeholder="One project per line"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Target Roles</label>
                <textarea
                  value={form.targetRolesText}
                  onChange={(event) => updateField('targetRolesText', event.target.value)}
                  rows={7}
                  className="input w-full"
                  placeholder="One target role per line"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase mb-2 block">Preferred Locations</label>
                <textarea
                  value={form.preferredLocationsText}
                  onChange={(event) => updateField('preferredLocationsText', event.target.value)}
                  rows={7}
                  className="input w-full"
                  placeholder="One location per line"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase mb-2 block">Work Authorization Note</label>
              <textarea
                value={form.workAuthorizationNote}
                onChange={(event) => updateField('workAuthorizationNote', event.target.value)}
                rows={3}
                className="input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase mb-2 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={3}
                className="input w-full"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-100 mb-3">What This Drives</h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li>• Job title fit against your saved target roles and current role.</li>
              <li>• Skill overlap for backend, AI, GenAI, and RAG-heavy roles.</li>
              <li>• Relevant-project signals for score explanations.</li>
              <li>• Seniority, location, and work-authorization-aware scoring.</li>
            </ul>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-100 mb-3">MVP Notes</h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li>• New ingests use the saved profile automatically.</li>
              <li>• Existing jobs need a rescore after profile updates.</li>
              <li>• Plain text resume input is supported directly; `.docx` should be pasted as text for now.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
