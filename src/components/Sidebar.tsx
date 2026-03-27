'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import IngestModal from './IngestModal';

export default function Sidebar() {
  const pathname = usePathname();
  const [ingestOpen, setIngestOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/review', label: 'Review Queue', icon: '📋' },
    { href: '/tracker', label: 'Tracker', icon: '✓' },
    { href: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <>
      <aside className="w-60 bg-[#111] border-r border-gray-800 flex flex-col p-6">
        {/* App name */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            Titan-3
          </h1>
          <p className="text-gray-500 text-xs mt-1">Review Console</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                pathname === item.href
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom action */}
        <button
          onClick={() => setIngestOpen(true)}
          className="btn btn-primary w-full py-3 text-sm font-medium"
        >
          + Ingest Job
        </button>
      </aside>

      {/* Ingest Modal */}
      <IngestModal open={ingestOpen} onClose={() => setIngestOpen(false)} />
    </>
  );
}
