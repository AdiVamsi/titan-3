'use client';

import { useState } from 'react';

interface IngestModalProps {
  open: boolean;
  onClose: () => void;
}

export default function IngestModal({ open, onClose }: IngestModalProps) {
  const [tab, setTab] = useState<'source' | 'manual'>('source');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  // Source tab state
  const [adapterId, setAdapterId] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Manual tab state
  const [jobUrl, setJobUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jdText, setJdText] = useState('');

  const handleSourceIngest = async () => {
    if (!adapterId || !sourceUrl) {
      setResult({ success: false, message: 'Please select an adapter and enter a URL' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/jobs/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual: false,
          adapter: adapterId,
          queryOrUrl: sourceUrl,
          config: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.error || data.message || 'Ingest failed' });
        return;
      }

      const ingestedCount = data.ingested ?? data.count ?? 0;
      setResult({
        success: true,
        message: data.message || `Successfully ingested ${ingestedCount} job(s)`,
        count: ingestedCount,
      });

      // Reset form
      setAdapterId('');
      setSourceUrl('');

      // Close modal after success
      setTimeout(() => {
        onClose();
        setResult(null);
        window.location.reload();
      }, 2000);
    } catch (error) {
      setResult({ success: false, message: 'Error ingesting jobs' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!jobUrl || !title || !company || !jdText) {
      setResult({ success: false, message: 'Please fill in all required fields' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/jobs/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual: true,
          url: jobUrl,
          rawText: jdText,
          title,
          companyName: company,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.error || data.message || 'Import failed' });
        return;
      }

      setResult({
        success: true,
        message: data.message || 'Job imported successfully',
        count: data.ingested ?? data.count ?? 1,
      });

      // Reset form
      setJobUrl('');
      setTitle('');
      setCompany('');
      setJdText('');

      // Close modal after success
      setTimeout(() => {
        onClose();
        setResult(null);
        window.location.reload();
      }, 2000);
    } catch (error) {
      setResult({ success: false, message: 'Error importing job' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111] border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800 sticky top-0 bg-[#111]">
          <h2 className="text-2xl font-bold text-white">Ingest Job</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-800 px-6">
          <button
            onClick={() => setTab('source')}
            className={`py-4 px-4 font-medium transition-all ${
              tab === 'source'
                ? 'text-white border-b-2 border-green-600 -mb-px'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            From Source
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`py-4 px-4 font-medium transition-all ${
              tab === 'manual'
                ? 'text-white border-b-2 border-green-600 -mb-px'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Manual Import
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {tab === 'source' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Adapter
                </label>
                <select
                  value={adapterId}
                  onChange={(e) => setAdapterId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Select an adapter...</option>
                  <option value="greenhouse">Greenhouse</option>
                  <option value="lever">Lever</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Board URL or Search Query
                </label>
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="e.g., https://linkedin.com/jobs/search/?keywords=..."
                  className="input w-full"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job URL *
                </label>
                <input
                  type="text"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://example.com/jobs/123"
                  className="input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Senior Engineer"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Company *
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g., Acme Corp"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Job Description *
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="input w-full h-32 resize-none"
                />
              </div>
            </>
          )}

          {/* Result message */}
          {result && (
            <div
              className={`p-4 rounded-lg text-sm ${
                result.success
                  ? 'bg-green-900 text-green-100 border border-green-800'
                  : 'bg-red-900 text-red-100 border border-red-800'
              }`}
            >
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={tab === 'source' ? handleSourceIngest : handleManualImport}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {tab === 'source' ? 'Ingesting...' : 'Importing...'}
                </>
              ) : (
                tab === 'source' ? 'Ingest' : 'Import'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
