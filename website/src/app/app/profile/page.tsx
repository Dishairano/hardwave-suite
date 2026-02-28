'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Settings,
  HardDrive,
  Cloud,
  RefreshCw,
  Trash2,
  LogOut,
  ChevronRight,
  Moon,
  Bell,
  Wifi,
  Crown,
  Zap,
  Wrench,
} from 'lucide-react';
import { getStorageStats, clearAllData, getLibraryMetadata, LibraryMetadata } from '@/lib/pwa/storage';
import { getSyncStatus, forceFullSync, SyncStatus } from '@/lib/pwa/sync';
import { checkForUpdates, clearCache, isInstalledPWA } from '@/lib/pwa';
import { hapticTap, hapticSuccess } from '@/lib/pwa/haptics';

interface StorageStats {
  filesCount: number;
  collectionsCount: number;
  favoritesCount: number;
  pendingSyncCount: number;
}

interface UserData {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

interface SubscriptionData {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [metadata, setMetadata] = useState<LibraryMetadata | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load user data from localStorage
        const userJson = localStorage.getItem('hardwave_user');
        const subJson = localStorage.getItem('hardwave_subscription');

        if (userJson) {
          setUser(JSON.parse(userJson));
        }
        if (subJson) {
          setSubscription(JSON.parse(subJson));
        }

        const [statsData, metadataData] = await Promise.all([
          getStorageStats(),
          getLibraryMetadata(),
        ]);
        setStats(statsData);
        setMetadata(metadataData);
        setSyncStatus(getSyncStatus());
        setIsPWA(isInstalledPWA());
      } catch (err) {
        console.error('Failed to load profile data:', err);
      }
    }

    loadData();
  }, []);

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatSubscriptionEnd = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const handleSync = async () => {
    if (isSyncing) return;
    hapticTap();
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('hardwave_token');
      if (token) {
        await forceFullSync(token);
      }
      const newStats = await getStorageStats();
      const newMetadata = await getLibraryMetadata();
      setStats(newStats);
      setMetadata(newMetadata);
      setSyncStatus(getSyncStatus());
      hapticSuccess();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = async () => {
    if (isClearing) return;
    hapticTap();

    const confirmed = window.confirm(
      'Clear all cached data? You will need to sync again to use offline features.'
    );
    if (!confirmed) return;

    setIsClearing(true);
    try {
      await clearAllData();
      await clearCache();
      setStats({
        filesCount: 0,
        collectionsCount: 0,
        favoritesCount: 0,
        pendingSyncCount: 0,
      });
      setMetadata(null);
      hapticSuccess();
    } catch (err) {
      console.error('Failed to clear cache:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCheckUpdates = async () => {
    hapticTap();
    const hasUpdate = await checkForUpdates();
    if (hasUpdate) {
      const reload = window.confirm(
        'A new version is available. Reload to update?'
      );
      if (reload) {
        window.location.reload();
      }
    } else {
      alert('You have the latest version.');
    }
  };

  const handleSignOut = async () => {
    hapticTap();

    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    // Clear all auth data
    localStorage.removeItem('hardwave_token');
    localStorage.removeItem('hardwave_user');
    localStorage.removeItem('hardwave_subscription');

    hapticSuccess();

    // Redirect to login
    router.replace('/app/login');
  };

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFA500] to-[#FF6B00] flex items-center justify-center">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName || 'User'}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-[#08080c]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">
            {user?.displayName || user?.email?.split('@')[0] || 'User'}
          </h1>
          <p className="text-xs text-white/60 mt-0.5 truncate">
            {user?.email || 'Not signed in'}
          </p>
          {subscription?.status === 'active' && (
            <div className="flex items-center gap-1 mt-1">
              <Crown className="w-3 h-3 text-[#FFA500]" />
              <span className="text-xs text-[#FFA500]">Pro Member</span>
            </div>
          )}
        </div>
      </header>

      {/* Subscription info */}
      {subscription && (
        <section className="mb-6">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            Subscription
          </h2>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">Hardwave Pro</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  subscription.status === 'active'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {subscription.status === 'active' ? 'Active' : subscription.status}
              </span>
            </div>
            <p className="text-xs text-white/40">
              Renews: {formatSubscriptionEnd(subscription.currentPeriodEnd)}
            </p>
          </div>
        </section>
      )}

      {/* Storage stats */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Library Stats
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={HardDrive}
            label="Samples"
            value={stats?.filesCount ?? 0}
            color="#FFA500"
          />
          <StatCard
            icon={Cloud}
            label="Collections"
            value={stats?.collectionsCount ?? 0}
            color="#00C9FF"
          />
        </div>
      </section>

      {/* Sync status */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Sync Status
        </h2>
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wifi
                className={`w-4 h-4 ${
                  syncStatus?.isOnline ? 'text-green-400' : 'text-red-400'
                }`}
              />
              <span className="text-sm text-white">
                {syncStatus?.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {(stats?.pendingSyncCount ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#FFA500]/20 text-[#FFA500] text-xs">
                {stats?.pendingSyncCount} pending
              </span>
            )}
          </div>
          <div className="text-xs text-white/40 mb-4">
            Last sync: {formatDate(metadata?.lastSync ?? null)}
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full h-10 rounded-lg bg-[#FFA500] text-[#08080c] text-sm font-semibold flex items-center justify-center gap-2 active:bg-[#FF8C00] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </section>

      {/* Tools */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Tools
        </h2>
        <div className="bg-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
          <Link
            href="/app/bpm-changer"
            className="w-full flex items-center gap-3 p-4 active:bg-white/5"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FFA500]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#FFA500]" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-white font-medium">BPM Changer</span>
              <p className="text-xs text-white/40 mt-0.5">
                Change tempo without affecting pitch
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </Link>
          <Link
            href="/app/key-detector"
            className="w-full flex items-center gap-3 p-4 active:bg-white/5"
          >
            <div className="w-10 h-10 rounded-lg bg-[#00D4AA]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#00D4AA]" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-white font-medium">Key Detector</span>
              <p className="text-xs text-white/40 mt-0.5">
                Detect musical key of audio files
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </Link>
          <Link
            href="/app/pitch-shifter"
            className="w-full flex items-center gap-3 p-4 active:bg-white/5"
          >
            <div className="w-10 h-10 rounded-lg bg-[#00C9FF]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#00C9FF]" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-white font-medium">Pitch Shifter</span>
              <p className="text-xs text-white/40 mt-0.5">
                Change pitch in semitones
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </Link>
          <Link
            href="/app/audio-trimmer"
            className="w-full flex items-center gap-3 p-4 active:bg-white/5"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FF6B6B]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#FF6B6B]" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-white font-medium">Audio Trimmer</span>
              <p className="text-xs text-white/40 mt-0.5">
                Cut and trim audio files
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </Link>
        </div>
      </section>

      {/* Settings */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Settings
        </h2>
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <SettingsRow
            icon={Moon}
            label="Dark Mode"
            value="Always On"
            disabled
          />
          <SettingsRow
            icon={Bell}
            label="Notifications"
            value="Off"
            disabled
          />
          <SettingsRow
            icon={Settings}
            label="Check for Updates"
            onClick={handleCheckUpdates}
          />
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          Account
        </h2>
        <div className="bg-white/5 rounded-xl overflow-hidden">
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="w-full flex items-center gap-3 p-4 text-left active:bg-white/5 disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5 text-orange-400" />
            <div className="flex-1">
              <span className="text-sm text-white">Clear Cache</span>
              <p className="text-xs text-white/40 mt-0.5">
                Remove all offline data
              </p>
            </div>
          </button>
          <div className="h-px bg-white/5" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-4 text-left active:bg-white/5"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400">Sign Out</span>
          </button>
        </div>
      </section>

      {/* Version */}
      <p className="text-center text-xs text-white/20 mt-8">
        Hardwave Suite v{metadata?.version ?? '1.0.0'}
        {isPWA && ' (Installed)'}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof HardDrive;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/60 mt-0.5">{label}</p>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  disabled,
}: {
  icon: typeof Settings;
  label: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Component = onClick ? 'button' : 'div';

  return (
    <>
      <Component
        onClick={onClick}
        disabled={disabled}
        className={`w-full flex items-center gap-3 p-4 ${
          onClick ? 'active:bg-white/5' : ''
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <Icon className="w-5 h-5 text-white/60" />
        <span className="flex-1 text-sm text-white text-left">{label}</span>
        {value && <span className="text-sm text-white/40">{value}</span>}
        {onClick && <ChevronRight className="w-4 h-4 text-white/40" />}
      </Component>
      <div className="h-px bg-white/5 last:hidden" />
    </>
  );
}
