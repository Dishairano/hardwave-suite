'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';

export function DownloadCard() {
  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Desktop App</h3>
          <p className="text-sm text-gray-400 mb-4">
            Download the all-in-one Hardwave Studios Suite
          </p>
        </div>
        <Download className="w-6 h-6 text-blue-400" />
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          KickForge - Kick Designer
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          Melody Generator
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          Sample Library
        </div>
      </div>

      <Link
        href="/dashboard/downloads"
        className="block w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-center rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition"
      >
        Download Now
      </Link>
    </div>
  );
}
