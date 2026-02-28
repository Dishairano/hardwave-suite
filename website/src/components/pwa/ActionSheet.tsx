'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { hapticTap } from '@/lib/pwa/haptics';

export interface ActionSheetOption {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  options: ActionSheetOption[];
}

export function ActionSheet({ isOpen, onClose, title, options }: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      hapticTap();
      onClose();
    }
  };

  // Handle option click
  const handleOptionClick = (option: ActionSheetOption) => {
    hapticTap();
    option.onClick();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg bg-[#12121a] rounded-t-2xl shadow-xl"
        style={{
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-medium text-white/80">{title}</h3>
            <button
              onClick={() => {
                hapticTap();
                onClose();
              }}
              className="p-1 rounded-full active:bg-white/10"
            >
              <X className="w-5 h-5 text-white/40" />
            </button>
          </div>
        )}

        {/* Options */}
        <div className="py-2">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(option)}
              className={`w-full flex items-center gap-3 px-4 py-3 active:bg-white/10 transition-colors ${
                option.variant === 'danger' ? 'text-red-400' : 'text-white'
              }`}
            >
              {option.icon && (
                <span className="flex-shrink-0 w-5 h-5">{option.icon}</span>
              )}
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Cancel button */}
        <div className="px-3 pb-3 pt-1">
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium active:bg-white/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
