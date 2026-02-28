'use client';

import { useState, useEffect } from 'react';
import { X, SlidersHorizontal, Check } from 'lucide-react';
import { hapticTap } from '@/lib/pwa/haptics';

export interface FilterOptions {
  bpmMin?: number;
  bpmMax?: number;
  keys?: string[];
  durationMin?: number;
  durationMax?: number;
  tags?: string[];
  sortBy: 'name' | 'date' | 'bpm' | 'duration';
  sortOrder: 'asc' | 'desc';
}

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  availableTags?: string[];
}

const MUSICAL_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Added' },
  { value: 'bpm', label: 'BPM' },
  { value: 'duration', label: 'Duration' },
];

export function FilterSheet({
  isOpen,
  onClose,
  filters,
  onApply,
  availableTags = [],
}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);

  useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, filters]);

  const handleApply = () => {
    hapticTap();
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    hapticTap();
    const resetFilters: FilterOptions = {
      sortBy: 'date',
      sortOrder: 'desc',
    };
    setLocalFilters(resetFilters);
  };

  const toggleKey = (key: string) => {
    hapticTap();
    setLocalFilters((prev) => {
      const keys = prev.keys || [];
      if (keys.includes(key)) {
        return { ...prev, keys: keys.filter((k) => k !== key) };
      }
      return { ...prev, keys: [...keys, key] };
    });
  };

  const toggleTag = (tag: string) => {
    hapticTap();
    setLocalFilters((prev) => {
      const tags = prev.tags || [];
      if (tags.includes(tag)) {
        return { ...prev, tags: tags.filter((t) => t !== tag) };
      }
      return { ...prev, tags: [...tags, tag] };
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hapticTap();
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg bg-[#12121a] rounded-t-2xl shadow-xl max-h-[85vh] flex flex-col"
        style={{
          animation: 'slideUp 0.3s ease-out',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#FFA500]" />
            <h3 className="text-sm font-medium text-white">Filters & Sort</h3>
          </div>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Sort */}
          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Sort By
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    hapticTap();
                    setLocalFilters((prev) => ({
                      ...prev,
                      sortBy: option.value as FilterOptions['sortBy'],
                    }));
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    localFilters.sortBy === option.value
                      ? 'bg-[#FFA500] text-[#08080c]'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  hapticTap();
                  setLocalFilters((prev) => ({ ...prev, sortOrder: 'asc' }));
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  localFilters.sortOrder === 'asc'
                    ? 'bg-[#FFA500] text-[#08080c]'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                Ascending
              </button>
              <button
                onClick={() => {
                  hapticTap();
                  setLocalFilters((prev) => ({ ...prev, sortOrder: 'desc' }));
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  localFilters.sortOrder === 'desc'
                    ? 'bg-[#FFA500] text-[#08080c]'
                    : 'bg-white/10 text-white/60'
                }`}
              >
                Descending
              </button>
            </div>
          </div>

          {/* BPM Range */}
          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              BPM Range
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="Min"
                value={localFilters.bpmMin || ''}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    bpmMin: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50"
              />
              <span className="text-white/40">-</span>
              <input
                type="number"
                placeholder="Max"
                value={localFilters.bpmMax || ''}
                onChange={(e) =>
                  setLocalFilters((prev) => ({
                    ...prev,
                    bpmMax: e.target.value ? parseInt(e.target.value) : undefined,
                  }))
                }
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/30 outline-none focus:ring-2 focus:ring-[#FFA500]/50"
              />
            </div>
            {/* Quick BPM presets */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { label: '150-160', min: 150, max: 160 },
                { label: '160-170', min: 160, max: 170 },
                { label: '170-180', min: 170, max: 180 },
                { label: '180-200', min: 180, max: 200 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => {
                    hapticTap();
                    setLocalFilters((prev) => ({
                      ...prev,
                      bpmMin: preset.min,
                      bpmMax: preset.max,
                    }));
                  }}
                  className="px-2 py-1 rounded bg-white/10 text-xs text-white/60 active:bg-white/20"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Musical Key */}
          <div>
            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              Key
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {MUSICAL_KEYS.slice(0, 12).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleKey(key)}
                  className={`w-10 h-8 rounded text-xs font-medium transition-colors ${
                    localFilters.keys?.includes(key)
                      ? 'bg-[#FFA500] text-[#08080c]'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {MUSICAL_KEYS.slice(12).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleKey(key)}
                  className={`w-10 h-8 rounded text-xs font-medium transition-colors ${
                    localFilters.keys?.includes(key)
                      ? 'bg-[#FFA500] text-[#08080c]'
                      : 'bg-white/10 text-white/60'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {availableTags.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      localFilters.tags?.includes(tag)
                        ? 'bg-[#FFA500] text-[#08080c]'
                        : 'bg-white/10 text-white/60'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-4 py-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={handleReset}
            className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm font-medium active:bg-white/20"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-3 rounded-xl bg-[#FFA500] text-[#08080c] text-sm font-medium active:opacity-80"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
