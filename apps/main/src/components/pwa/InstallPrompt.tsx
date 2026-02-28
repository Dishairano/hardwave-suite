'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Only run once
    if (initialized.current) return;
    initialized.current = true;

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInStandalone =
      'standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isStandalone || isInStandalone) {
      return; // Already installed, don't show
    }

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);

    // Check if previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedExpiry = dismissed ? parseInt(dismissed, 10) : 0;
    if (dismissedExpiry > Date.now()) {
      return; // Recently dismissed
    }

    if (isIOSDevice) {
      setIsIOS(true);
      setIsVisible(true);
    }
  }, []);

  // Listen for Android/Desktop install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Check if dismissed
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      const dismissedExpiry = dismissed ? parseInt(dismissed, 10) : 0;
      if (dismissedExpiry <= Date.now()) {
        setIsVisible(true);
      }
    };

    const handleInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Remember dismissal for 7 days
    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('pwa-install-dismissed', expiry.toString());
  }, []);

  if (!isVisible) {
    return null;
  }

  // iOS-specific install instructions
  if (isIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-[#1a1a1f] border border-white/10 rounded-xl p-4 shadow-xl">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full text-white/40 hover:text-white/60"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFA500] to-[#FF6B00] flex items-center justify-center">
              <span className="text-xl font-bold text-[#08080c]">H</span>
            </div>
            <div className="flex-1 pr-6">
              <h3 className="text-sm font-semibold text-white">
                Install Hardwave Suite
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Add to your home screen for the best experience
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs text-white/60 bg-white/5 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-60">1.</span>
              <span>Tap</span>
              <Share className="w-4 h-4 text-[#007AFF]" />
            </div>
            <span className="text-white/20">then</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-60">2.</span>
              <span>Add to Home Screen</span>
              <PlusSquare className="w-4 h-4 text-white/60" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop install prompt
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#1a1a1f] border border-white/10 rounded-xl p-4 shadow-xl">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full text-white/40 hover:text-white/60"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFA500] to-[#FF6B00] flex items-center justify-center">
            <span className="text-xl font-bold text-[#08080c]">H</span>
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-sm font-semibold text-white">
              Install Hardwave Suite
            </h3>
            <p className="text-xs text-white/60 mt-1">
              Browse your samples offline anytime
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 h-10 rounded-lg bg-white/10 text-white/80 text-sm font-medium active:bg-white/15 transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 h-10 rounded-lg bg-[#FFA500] text-[#08080c] text-sm font-semibold flex items-center justify-center gap-2 active:bg-[#FF8C00] transition-colors"
          >
            <Download className="w-4 h-4" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
