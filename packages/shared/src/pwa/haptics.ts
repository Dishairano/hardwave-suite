/**
 * Haptic feedback utilities for PWA
 * Uses Vibration API where supported
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 100, 50, 100, 50],
};

/**
 * Check if haptic feedback is supported
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 */
export function haptic(style: HapticStyle = 'light'): void {
  if (!isHapticsSupported()) return;

  try {
    const pattern = HAPTIC_PATTERNS[style];
    navigator.vibrate(pattern);
  } catch {
    // Silently fail if vibration not allowed
  }
}

/**
 * Trigger haptic on tap (for button presses)
 */
export function hapticTap(): void {
  haptic('light');
}

/**
 * Trigger haptic for selection changes
 */
export function hapticSelection(): void {
  haptic('medium');
}

/**
 * Trigger haptic for successful action
 */
export function hapticSuccess(): void {
  haptic('success');
}

/**
 * Trigger haptic for errors
 */
export function hapticError(): void {
  haptic('error');
}
