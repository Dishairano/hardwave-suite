'use client';

import { useState, useEffect, useMemo } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { subscribeSyncStatus, SyncStatus as SyncStatusType } from '@/lib/pwa/sync';

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusType>({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    pendingChanges: 0,
    error: null,
  });

  // Track current time for relative time display
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setStatus);
    return unsubscribe;
  }, []);

  // Update current time periodically for relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const lastSyncText = useMemo(() => {
    const date = status.lastSync;
    if (!date) return 'Never';
    const diff = now - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }, [status.lastSync, now]);

  // Syncing state
  if (status.isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFA500]/10 text-[#FFA500] text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  // Offline state
  if (!status.isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/60 text-xs">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Offline</span>
        {status.pendingChanges > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#FFA500]/20 text-[#FFA500] text-[10px]">
            {status.pendingChanges}
          </span>
        )}
      </div>
    );
  }

  // Error state
  if (status.error) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Sync error</span>
      </div>
    );
  }

  // Pending changes
  if (status.pendingChanges > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFA500]/10 text-[#FFA500] text-xs">
        <Cloud className="w-3.5 h-3.5" />
        <span>{status.pendingChanges} pending</span>
      </div>
    );
  }

  // Synced state
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 text-xs">
      <Check className="w-3.5 h-3.5" />
      <span>{lastSyncText}</span>
    </div>
  );
}
