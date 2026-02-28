'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SearchBar, SearchFilters } from '@/components/pwa/SearchBar';
import { FileList } from '@/components/pwa/FileList';
import { SyncStatus } from '@/components/pwa/SyncStatus';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { ActionSheet, ActionSheetOption } from '@/components/pwa/ActionSheet';
import { CollectionPicker } from '@/components/pwa/CollectionPicker';
import { FilterSheet, FilterOptions } from '@/components/pwa/FilterSheet';
import { BulkActionBar } from '@/components/pwa/BulkActionBar';
import { FileGrid, FileGridItem } from '@/components/pwa/FileGrid';
import { useAudioPlayer } from '@/components/pwa/AudioPlayerContext';
import {
  AudioFile,
  getAllFiles,
  searchFiles,
  toggleFavorite,
  initDB,
  isIndexedDBAvailable,
} from '@/lib/pwa/storage';
import { initSync, needsSync, syncLibrary, syncFavoriteInline } from '@/lib/pwa/sync';
import { hapticSuccess, hapticError, hapticTap } from '@/lib/pwa/haptics';
import { shareSample, shareMultipleSamples } from '@/lib/pwa/share';
import { RefreshCw, Heart, FolderPlus, Info, Share2, Grid, List, SlidersHorizontal } from 'lucide-react';

export default function LibraryPage() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [advancedFilters, setAdvancedFilters] = useState<FilterOptions>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Selection mode for bulk actions
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Audio player
  const audioPlayer = useAudioPlayer();

  // Available tags for filter
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    files.forEach((file) => {
      file.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [files]);

  // Initialize DB and sync
  useEffect(() => {
    async function init() {
      if (!isIndexedDBAvailable()) {
        setError('IndexedDB not available. Offline mode disabled.');
        setIsLoading(false);
        return;
      }

      try {
        await initDB();
        initSync();

        // Load cached files
        const cachedFiles = await getAllFiles();
        setFiles(cachedFiles);
        setIsLoading(false);

        // Check if we need to sync
        if (await needsSync()) {
          console.log('Data may be stale, sync recommended');
        }
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load library');
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Handle search
  useEffect(() => {
    async function performSearch() {
      if (!searchQuery.trim()) {
        const allFiles = await getAllFiles();
        setFiles(allFiles);
        return;
      }

      const results = await searchFiles(searchQuery);
      setFiles(results);
    }

    performSearch();
  }, [searchQuery]);

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Apply BPM filter from advanced filters
    if (advancedFilters.bpmMin !== undefined) {
      result = result.filter((f) => f.bpm && f.bpm >= advancedFilters.bpmMin!);
    }
    if (advancedFilters.bpmMax !== undefined) {
      result = result.filter((f) => f.bpm && f.bpm <= advancedFilters.bpmMax!);
    }

    // Apply key filter from advanced filters
    if (advancedFilters.keys && advancedFilters.keys.length > 0) {
      result = result.filter((f) => f.key && advancedFilters.keys!.includes(f.key));
    }

    // Apply tags filter
    if (advancedFilters.tags && advancedFilters.tags.length > 0) {
      result = result.filter((f) =>
        f.tags && f.tags.some(tag => advancedFilters.tags!.includes(tag))
      );
    }

    // Also respect search bar filters
    if (filters.bpmMin !== undefined) {
      result = result.filter((f) => f.bpm && f.bpm >= filters.bpmMin!);
    }
    if (filters.bpmMax !== undefined) {
      result = result.filter((f) => f.bpm && f.bpm <= filters.bpmMax!);
    }
    if (filters.key) {
      result = result.filter((f) => f.key === filters.key);
    }

    // Apply sorting from advanced filters
    const sortBy = advancedFilters.sortBy || filters.sortBy || 'date';
    const sortOrder = advancedFilters.sortOrder || filters.sortOrder || 'desc';

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'date':
          comparison =
            new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
          break;
        case 'bpm':
          comparison = (a.bpm || 0) - (b.bpm || 0);
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [files, filters, advancedFilters]);

  // Handle favorite toggle with inline sync
  const handleFavoriteToggle = useCallback(
    async (id: string, isFavorite: boolean) => {
      try {
        // Optimistically update UI
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isFavorite } : f))
        );

        // Update local IndexedDB
        await toggleFavorite(id, isFavorite);

        // Inline sync to server
        const result = await syncFavoriteInline(id, isFavorite);
        if (result.success) {
          hapticSuccess();
        } else {
          console.warn('Favorite sync queued for later:', result.error);
          // Still show success since local update worked
          hapticSuccess();
        }
      } catch (err) {
        console.error('Failed to toggle favorite:', err);
        // Revert optimistic update
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isFavorite: !isFavorite } : f))
        );
        hapticError();
      }
    },
    []
  );

  // Handle file tap (for future: show details modal)
  const handleFileTap = useCallback((id: string) => {
    console.log('File tapped:', id);
    // TODO: Show file details modal
  }, []);

  // Handle play/pause
  const handlePlay = useCallback(
    (id: string) => {
      const file = files.find((f) => f.id === id);
      if (!file) return;

      if (audioPlayer.currentTrack?.id === id && audioPlayer.isPlaying) {
        audioPlayer.pause();
      } else if (audioPlayer.currentTrack?.id === id) {
        audioPlayer.resume();
      } else {
        audioPlayer.play({
          id: file.id,
          name: file.filename,
          bpm: file.bpm,
          key: file.key,
          duration: file.duration,
        });
      }
    },
    [files, audioPlayer]
  );

  // Handle long press - enter selection mode
  const handleLongPress = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  // Handle selection toggle
  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      // Exit selection mode if nothing selected
      if (newSet.size === 0) {
        setSelectionMode(false);
      }
      return newSet;
    });
  }, []);

  // Cancel selection mode
  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Select all files
  const handleSelectAll = useCallback(() => {
    hapticTap();
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  }, [filteredFiles]);

  // Bulk favorite
  const handleBulkFavorite = useCallback(async () => {
    hapticTap();
    const idsToFavorite = Array.from(selectedIds);
    for (const id of idsToFavorite) {
      try {
        await toggleFavorite(id, true);
        setFiles((prev) =>
          prev.map((f) => (f.id === id ? { ...f, isFavorite: true } : f))
        );
        await syncFavoriteInline(id, true);
      } catch (err) {
        console.error('Failed to favorite:', err);
      }
    }
    hapticSuccess();
    handleCancelSelection();
  }, [selectedIds, handleCancelSelection]);

  // Bulk add to collection
  const handleBulkAddToCollection = useCallback(() => {
    hapticTap();
    // For bulk, we use the first selected file for the picker
    const firstId = Array.from(selectedIds)[0];
    if (firstId) {
      setSelectedFileId(firstId);
      setCollectionPickerOpen(true);
    }
  }, [selectedIds]);

  // Bulk share
  const handleBulkShare = useCallback(async () => {
    hapticTap();
    const selectedFiles = files.filter((f) => selectedIds.has(f.id));
    const samples = selectedFiles.map((f) => ({ filename: f.filename, id: f.id }));
    const success = await shareMultipleSamples(samples);
    if (success) {
      hapticSuccess();
      handleCancelSelection();
    }
  }, [files, selectedIds, handleCancelSelection]);

  // Share single file
  const handleShare = useCallback(async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    hapticTap();
    await shareSample(file.filename, file.id, { bpm: file.bpm, key: file.key });
  }, [files]);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    hapticTap();
    setViewMode((prev) => (prev === 'list' ? 'grid' : 'list'));
  }, []);

  // Apply advanced filters
  const handleApplyFilters = useCallback((newFilters: FilterOptions) => {
    setAdvancedFilters(newFilters);
    // Also sync with basic filters for sorting
    setFilters((prev) => ({
      ...prev,
      sortBy: newFilters.sortBy as 'name' | 'date' | 'bpm' | 'key',
      sortOrder: newFilters.sortOrder,
    }));
  }, []);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.bpmMin !== undefined || advancedFilters.bpmMax !== undefined) count++;
    if (advancedFilters.keys && advancedFilters.keys.length > 0) count++;
    if (advancedFilters.tags && advancedFilters.tags.length > 0) count++;
    return count;
  }, [advancedFilters]);

  // Handle more press - show action sheet
  const handleFileMorePress = useCallback((id: string) => {
    setSelectedFileId(id);
    setActionSheetOpen(true);
  }, []);

  // Handle add to collection
  const handleAddToCollection = useCallback((id: string) => {
    setSelectedFileId(id);
    setCollectionPickerOpen(true);
  }, []);

  // Get selected file
  const selectedFile = useMemo(
    () => files.find((f) => f.id === selectedFileId),
    [files, selectedFileId]
  );

  // Action sheet options
  const actionSheetOptions: ActionSheetOption[] = useMemo(() => {
    if (!selectedFile) return [];

    return [
      {
        label: selectedFile.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
        icon: <Heart className={`w-5 h-5 ${selectedFile.isFavorite ? 'fill-current' : ''}`} />,
        onClick: () => {
          handleFavoriteToggle(selectedFile.id, !selectedFile.isFavorite);
        },
      },
      {
        label: 'Add to Collection',
        icon: <FolderPlus className="w-5 h-5" />,
        onClick: () => {
          handleAddToCollection(selectedFile.id);
        },
      },
      {
        label: 'Share',
        icon: <Share2 className="w-5 h-5" />,
        onClick: () => {
          handleShare(selectedFile.id);
        },
      },
      {
        label: 'View Details',
        icon: <Info className="w-5 h-5" />,
        onClick: () => {
          handleFileTap(selectedFile.id);
        },
      },
    ];
  }, [selectedFile, handleFavoriteToggle, handleAddToCollection, handleShare, handleFileTap]);

  // Pull to refresh handler
  const handlePullRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Get auth token if available
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('hardwave_token')
        : null;

      if (token) {
        // Sync with server
        await syncLibrary(token);
      }

      // Reload files from IndexedDB
      const cachedFiles = await getAllFiles();
      setFiles(cachedFiles);
      setLastSynced(new Date());
      hapticSuccess();
    } catch (err) {
      console.error('Sync failed:', err);
      setError('Failed to sync. Pull down to try again.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Manual refresh (button)
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await handlePullRefresh();
    setIsLoading(false);
  }, [handlePullRefresh]);

  return (
    <>
      {/* Bulk Action Bar */}
      {selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onCancel={handleCancelSelection}
          onSelectAll={handleSelectAll}
          onFavorite={handleBulkFavorite}
          onAddToCollection={handleBulkAddToCollection}
          onShare={handleBulkShare}
        />
      )}

      <PullToRefresh onRefresh={handlePullRefresh} disabled={isSyncing}>
        <div className={`px-4 pt-4 ${selectionMode ? 'mt-14' : ''}`}>
          {/* Header */}
          <header className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">Library</h1>
              <p className="text-xs text-white/60 mt-0.5">
                {filteredFiles.length} samples
                {lastSynced && (
                  <span className="ml-2">
                    synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <SyncStatus />
              {/* Filter button */}
              <button
                onClick={() => {
                  hapticTap();
                  setFilterSheetOpen(true);
                }}
                className="relative p-2 rounded-lg bg-white/5 active:bg-white/10"
                aria-label="Filters"
              >
                <SlidersHorizontal className="w-5 h-5 text-white/60" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FFA500] text-[10px] font-bold text-[#08080c] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {/* View toggle */}
              <button
                onClick={toggleViewMode}
                className="p-2 rounded-lg bg-white/5 active:bg-white/10"
                aria-label={viewMode === 'list' ? 'Grid view' : 'List view'}
              >
                {viewMode === 'list' ? (
                  <Grid className="w-5 h-5 text-white/60" />
                ) : (
                  <List className="w-5 h-5 text-white/60" />
                )}
              </button>
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isLoading || isSyncing}
                className="p-2 rounded-lg bg-white/5 active:bg-white/10 disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={`w-5 h-5 text-white/60 ${
                    isLoading || isSyncing ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
          </header>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-400/60 underline mt-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Search */}
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
          />

          {/* Swipe hint for new users */}
          {filteredFiles.length > 0 && filteredFiles.length <= 5 && !selectionMode && viewMode === 'list' && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[#FFA500]/10 border border-[#FFA500]/20">
              <p className="text-xs text-[#FFA500]/80">
                Tip: Long press to select, swipe right to favorite
              </p>
            </div>
          )}

          {/* File list or grid */}
          <div className="mt-4">
            {viewMode === 'list' ? (
              <FileList
                files={filteredFiles.map((f) => ({
                  ...f,
                  isPlaying: audioPlayer.currentTrack?.id === f.id && audioPlayer.isPlaying,
                  isSelected: selectedIds.has(f.id),
                  selectionMode,
                }))}
                isLoading={isLoading}
                onFavoriteToggle={handleFavoriteToggle}
                onFileTap={handleFileTap}
                onFileMorePress={handleFileMorePress}
                onAddToCollection={handleAddToCollection}
                onPlay={handlePlay}
                onSelect={handleSelect}
                onLongPress={handleLongPress}
                emptyMessage={
                  searchQuery
                    ? 'No samples match your search'
                    : 'No samples in your library. Pull down to sync.'
                }
              />
            ) : (
              <FileGrid>
                {isLoading ? (
                  <div className="col-span-2 flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 text-[#FFA500] animate-spin" />
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-white/40">
                    {searchQuery ? 'No samples match your search' : 'No samples in your library'}
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <FileGridItem
                      key={file.id}
                      id={file.id}
                      filename={file.filename}
                      bpm={file.bpm}
                      musicalKey={file.key}
                      duration={file.duration}
                      isFavorite={file.isFavorite}
                      isPlaying={audioPlayer.currentTrack?.id === file.id && audioPlayer.isPlaying}
                      isSelected={selectedIds.has(file.id)}
                      selectionMode={selectionMode}
                      onPlay={handlePlay}
                      onFavoriteToggle={handleFavoriteToggle}
                      onMorePress={handleFileMorePress}
                      onSelect={handleSelect}
                      onLongPress={handleLongPress}
                    />
                  ))
                )}
              </FileGrid>
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* Action Sheet */}
      <ActionSheet
        isOpen={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        title={selectedFile?.filename}
        options={actionSheetOptions}
      />

      {/* Collection Picker */}
      <CollectionPicker
        isOpen={collectionPickerOpen}
        onClose={() => setCollectionPickerOpen(false)}
        fileId={selectedFileId || ''}
        filename={selectedFile?.filename || ''}
        currentCollectionIds={selectedFile?.collectionIds}
      />

      {/* Filter Sheet */}
      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={advancedFilters}
        onApply={handleApplyFilters}
        availableTags={availableTags}
      />
    </>
  );
}
