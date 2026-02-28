'use client';

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { getSyncStatus, syncPendingChanges, SyncStatus } from '@/lib/pwa/sync';
import { getStorageStats } from '@/lib/pwa/storage';

type SyncState = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export function SyncIndicator() {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout;
    let mounted = true;

    const checkAndSync = async () => {
      if (!mounted) return;

      const status = getSyncStatus();
      const stats = await getStorageStats();

      setPendingCount(stats.pendingSyncCount);

      if (!status.isOnline) {
        setSyncState('offline');
        setIsVisible(stats.pendingSyncCount > 0);
        return;
      }

      if (stats.pendingSyncCount > 0) {
        setSyncState('syncing');
        setIsVisible(true);

        try {
          const token = localStorage.getItem('hardwave_token');
          if (token) {
            await syncPendingChanges(token);
            if (mounted) {
              setSyncState('success');
              const newStats = await getStorageStats();
              setPendingCount(newStats.pendingSyncCount);

              // Hide success indicator after 2 seconds
              setTimeout(() => {
                if (mounted) {
                  setIsVisible(false);
                  setSyncState('idle');
                }
              }, 2000);
            }
          }
        } catch (err) {
          console.error('Sync failed:', err);
          if (mounted) {
            setSyncState('error');
            // Hide error after 3 seconds
            setTimeout(() => {
              if (mounted) {
                setIsVisible(false);
                setSyncState('idle');
              }
            }, 3000);
          }
        }
      } else {
        setIsVisible(false);
        setSyncState('idle');
      }
    };

    // Initial check
    checkAndSync();

    // Auto-sync every 30 seconds
    syncInterval = setInterval(checkAndSync, 30000);

    // Listen for online/offline events
    const handleOnline = () => {
      checkAndSync();
    };

    const handleOffline = () => {
      setSyncState('offline');
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      clearInterval(syncInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (syncState) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
        return <Check className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'offline':
        return <CloudOff className="w-4 h-4" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  const getMessage = () => {
    switch (syncState) {
      case 'syncing':
        return `Syncing ${pendingCount} change${pendingCount !== 1 ? 's' : ''}...`;
      case 'success':
        return 'All changes synced';
      case 'error':
        return 'Sync failed, will retry';
      case 'offline':
        return `Offline - ${pendingCount} pending`;
      default:
        return '';
    }
  };

  const getColor = () => {
    switch (syncState) {
      case 'syncing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'offline':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-30 flex items-center justify-center py-1 safe-area-pt ${getColor()} border-b`}
      style={{ animation: 'slideDown 0.2s ease-out' }}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {getIcon()}
        <span>{getMessage()}</span>
      </div>
    </div>
  );
}
