'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return no-op functions if not wrapped in provider (graceful fallback)
    return {
      toast: (message: string) => console.warn('[Toast]', message),
      toastSuccess: (message: string) => console.warn('[Toast]', message),
      toastError: (message: string) => console.error('[Toast]', message),
    };
  }
  return ctx;
}

const toastColors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#052e16', border: '#10B981', icon: '#10B981' },
  error: { bg: '#2d0a0a', border: '#EF4444', icon: '#EF4444' },
  warning: { bg: '#2d1f04', border: '#F59E0B', icon: '#F59E0B' },
  info: { bg: '#0a1a2d', border: '#3B82F6', icon: '#3B82F6' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const colors = toastColors[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}40`,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: 8,
        color: '#ffffff',
        fontSize: 14,
        minWidth: 280,
        maxWidth: 420,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        transform: exiting ? 'translateX(120%)' : 'translateX(0)',
        opacity: exiting ? 0 : 1,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => {
          setExiting(true);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#71717a',
          cursor: 'pointer',
          padding: 2,
          lineHeight: 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const value: ToastContextType = {
    toast: addToast,
    toastSuccess: (message: string) => addToast(message, 'success'),
    toastError: (message: string) => addToast(message, 'error'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// Confirmation dialog
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#18181b',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: '90%',
        }}
      >
        <h3 style={{ margin: '0 0 8px', color: '#ffffff', fontSize: 16, fontWeight: 600 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', color: '#a1a1aa', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: 'transparent',
              color: '#a1a1aa',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#EF4444',
              color: '#ffffff',
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
