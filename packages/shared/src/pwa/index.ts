/**
 * PWA utilities for Hardwave Suite mobile companion
 */

export * from './storage';
export * from './sync';
export * from './haptics';

/**
 * Check if the app is running as an installed PWA
 */
export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // iOS Safari check
  if (
    'standalone' in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  ) {
    return true;
  }

  return false;
}

/**
 * Check if PWA can be installed
 */
export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // Already installed
  if (isInstalledPWA()) return false;

  // Check for beforeinstallprompt support
  return 'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            dispatchPWAEvent('update-available', { registration });
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

/**
 * Update service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  await registration.update();
}

/**
 * Skip waiting and activate new service worker
 */
export async function activateNewServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    registration.active.postMessage({ type: 'CLEAR_CACHE' });
  }
}

/**
 * Dispatch custom PWA events
 */
function dispatchPWAEvent(
  type: string,
  detail?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`pwa:${type}`, { detail }));
}

/**
 * Check for app updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return registration.waiting !== null;
  } catch {
    return false;
  }
}

/**
 * Get push notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Request push notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';

  const permission = await Notification.requestPermission();
  return permission;
}
