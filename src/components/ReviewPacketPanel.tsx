'use client';

import { useState } from 'react';

interface ReviewPacket {
  id?: string;
  jobId?: string;
  resumeEmphasis?: string[];
  summaryRewrite?: string;
  keyBullets?: string[];
  whyApply?: string;
  risks?: string[];
  interviewPrep?: string[];
  outreachDraft?: string;
  sponsorNotes?: string;
}

interface ReviewPacketPanelProps {
  packet?: ReviewPacket | null;
  loading?: boolean;
  error?: string | null;
  onGenerate?: () => void;
}

function safeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function safeText(value: unknown, fallback = 'No content') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export default function ReviewPacketPanel({
  packet,
  loading,
  error,
  onGenerate,
}: ReviewPacketPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summaryRewrite: true,
    resumeEmphasis: true,
    keyBullets: true,
    whyApply: true,
    risks: false,
    interviewPrep: true,
    outreach: false,
    sponsorNotes: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (loading) {
    return (
      <div className="card h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          <p className="text-gray-400">Loading review packet...</p>
        </div>
      </div>
    );
  }

  if (!packet) {
    return (
      <div className="card h-full flex flex-col items-center justify-center text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-100 mb-2">No Review Packet Yet</h3>
        <p className="text-gray-400 mb-4">Generate a review packet to get application guidance.</p>
        {error ? (
          <p className="text-sm text-red-300 mb-4">{error}</p>
        ) : null}
        <button
          onClick={onGenerate}
          className="btn btn-primary"
          disabled={!onGenerate}
        >
          Generate Packet
        </button>
      </div>
    );
  }

  const safePacket = {
    summaryRewrite: safeText(packet.summaryRewrite, 'No match summary available yet.'),
    resumeEmphasis: safeList(packet.resumeEmphasis),
    keyBullets: safeList(packet.keyBullets),
    whyApply: safeText(packet.whyApply, 'No match explanation available yet.'),
    risks: safeList(packet.risks),
    interviewPrep: safeList(packet.interviewPrep),
    outreachDraft: safeText(packet.outreachDraft, 'No outreach draft available yet.'),
    sponsorNotes: safeText(packet.sponsorNotes, 'No sponsorship notes available yet.'),
  };

  const Section = ({
    title,
    id,
    content,
    type = 'text',
  }: {
    title: string;
    id: string;
    content?: string | string[];
    type?: 'text' | 'list';
  }) => {
    const isExpanded = expandedSections[id];

    return (
      <div className="border-b border-gray-800 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-800 transition-colors text-left"
        >
          <h4 className="font-semibold text-gray-200">{title}</h4>
          <span
            className="text-gray-400 transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            ▼
          </span>
        </button>

        {isExpanded ? (
          <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
            {type === 'text' ? (
              <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                {content || 'No content'}
              </p>
            ) : (
              <ul className="space-y-2">
                {Array.isArray(content) && content.length > 0 ? (
                  content.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No items</p>
                )}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="card p-0 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900">
        <h3 className="font-bold text-gray-100 text-lg flex items-center gap-2">
          <span>📝</span>
          Review Packet
        </h3>
        <p className="text-xs text-gray-500 mt-1">Application guidance for scored jobs</p>
      </div>

      {error ? (
        <div className="px-4 py-3 border-b border-red-900 bg-red-950 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-y-auto flex-1">
        <Section
          title="Match Summary"
          id="summaryRewrite"
          content={safePacket.summaryRewrite}
          type="text"
        />

        <Section
          title="Resume Emphasis"
          id="resumeEmphasis"
          content={safePacket.resumeEmphasis}
          type="list"
        />

        <Section
          title="Key Bullets To Highlight"
          id="keyBullets"
          content={safePacket.keyBullets}
          type="list"
        />

        <Section
          title="Why Apply"
          id="whyApply"
          content={safePacket.whyApply}
          type="text"
        />

        <Section
          title="Potential Risks / Gaps"
          id="risks"
          content={safePacket.risks}
          type="list"
        />

        <Section
          title="Interview Prep"
          id="interviewPrep"
          content={safePacket.interviewPrep}
          type="list"
        />

        <Section
          title="Outreach Draft"
          id="outreach"
          content={safePacket.outreachDraft}
          type="text"
        />

        <Section
          title="Sponsorship Notes"
          id="sponsorNotes"
          content={safePacket.sponsorNotes}
          type="text"
        />
      </div>

      <div className="px-6 py-3 border-t border-gray-800 bg-gray-900">
        <button
          onClick={onGenerate}
          className="btn btn-secondary w-full text-sm"
          disabled={!onGenerate}
        >
          ↻ Regenerate Packet
        </button>
      </div>
    </div>
  );
}
