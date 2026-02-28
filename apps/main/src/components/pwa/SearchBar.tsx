'use client';

import { useState, useRef } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';

export interface SearchFilters {
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
  sortBy?: 'name' | 'date' | 'bpm' | 'key';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  filters?: SearchFilters;
  onFiltersChange?: (filters: SearchFilters) => void;
  placeholder?: string;
  showFilters?: boolean;
}

const MUSICAL_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Added' },
  { value: 'bpm', label: 'BPM' },
  { value: 'key', label: 'Key' },
];

export function SearchBar({
  value,
  onChange,
  filters = {},
  onFiltersChange,
  placeholder = 'Search samples...',
  showFilters = true,
}: SearchBarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters =
    filters.bpmMin !== undefined ||
    filters.bpmMax !== undefined ||
    filters.key !== undefined;

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleFilterChange = (key: keyof SearchFilters, value: unknown) => {
    onFiltersChange?.({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange?.({
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
  };

  return (
    <div className="sticky top-0 z-40 bg-[#08080c] pb-3">
      {/* Search input */}
      <div
        className={`flex items-center gap-2 px-3 h-11 rounded-lg transition-all ${
          isFocused
            ? 'bg-white/10 ring-1 ring-[#FFA500]/50'
            : 'bg-white/5'
        }`}
      >
        <Search className="w-5 h-5 text-white/40 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
        />
        {value && (
          <button
            onClick={handleClear}
            className="p-1 rounded-full active:bg-white/10"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        )}
        {showFilters && (
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`p-1.5 rounded-lg transition-colors ${
              hasActiveFilters || isFiltersOpen
                ? 'bg-[#FFA500]/20 text-[#FFA500]'
                : 'text-white/60 active:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters panel */}
      {isFiltersOpen && showFilters && (
        <div className="mt-3 p-3 bg-white/5 rounded-lg space-y-4">
          {/* BPM Range */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              BPM Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filters.bpmMin ?? ''}
                onChange={(e) =>
                  handleFilterChange(
                    'bpmMin',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Min"
                className="flex-1 h-9 px-3 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-[#FFA500]/50"
              />
              <span className="text-white/40">-</span>
              <input
                type="number"
                value={filters.bpmMax ?? ''}
                onChange={(e) =>
                  handleFilterChange(
                    'bpmMax',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Max"
                className="flex-1 h-9 px-3 rounded-lg bg-white/10 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-[#FFA500]/50"
              />
            </div>
          </div>

          {/* Key select */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Key
            </label>
            <div className="relative">
              <select
                value={filters.key ?? ''}
                onChange={(e) =>
                  handleFilterChange(
                    'key',
                    e.target.value || undefined
                  )
                }
                className="w-full h-9 px-3 pr-8 rounded-lg bg-white/10 text-white text-sm outline-none appearance-none focus:ring-1 focus:ring-[#FFA500]/50"
              >
                <option value="" className="bg-[#08080c]">Any key</option>
                {MUSICAL_KEYS.map((key) => (
                  <option key={key} value={key} className="bg-[#08080c]">
                    {key}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="text-xs font-medium text-white/60 mb-2 block">
              Sort by
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={filters.sortBy ?? 'date'}
                  onChange={(e) =>
                    handleFilterChange(
                      'sortBy',
                      e.target.value as SearchFilters['sortBy']
                    )
                  }
                  className="w-full h-9 px-3 pr-8 rounded-lg bg-white/10 text-white text-sm outline-none appearance-none focus:ring-1 focus:ring-[#FFA500]/50"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#08080c]">
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
              <button
                onClick={() =>
                  handleFilterChange(
                    'sortOrder',
                    filters.sortOrder === 'asc' ? 'desc' : 'asc'
                  )
                }
                className="h-9 px-3 rounded-lg bg-white/10 text-white/60 text-sm active:bg-white/15"
              >
                {filters.sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </button>
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full h-9 rounded-lg bg-white/10 text-[#FFA500] text-sm font-medium active:bg-white/15"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
