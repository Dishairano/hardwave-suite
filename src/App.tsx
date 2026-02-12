import { useEffect, useRef, useCallback, useState } from 'react'
import { OrganizerSidebar, Toolbar } from './components/organizer'
import { ImportModal } from './components/ImportModal'
import { Button } from './components/Button'
import { LoginScreen } from './components/LoginScreen'
import { SubscriptionRequired } from './components/SubscriptionRequired'
import { UpdatePopup } from './components/UpdatePopup'
import { HubView } from './views/HubView'
import { KickforgeView } from './views/KickforgeView'
import { SettingsView } from './views/SettingsView'
import { TagManagementModal } from './components/TagManagementModal'
import { CreateCollectionModal } from './components/CreateCollectionModal'
import { AddTagsModal } from './components/AddTagsModal'
import { AddToCollectionModal } from './components/AddToCollectionModal'
import { FilterPanel } from './components/FilterPanel'
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal'
import { FileDetailsPanel } from './components/FileDetailsPanel'
import { ContextMenu, createFileContextMenuItems } from './components/ContextMenu'
import { VirtualizedFileGrid } from './components/VirtualizedFileGrid'
import { useAppStore } from './store'

function App() {
  // Get state and actions from store
  const {
    auth,
    verifyAuth,
    login,
    logout,
    update,
    setUpdate,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    checkUpdates,
    currentTool,
    setCurrentTool,
    files,
    tags,
    collections,
    stats,
    hasMoreFiles,
    isLoadingMore,
    loadData,
    loadMoreFiles,
    searchQuery,
    setSearchQuery,
    searchFiles,
    toggleFavorite,
    deleteFiles,
    createTag,
    deleteTag,
    addTagsToFiles,
    createCollection,
    addFilesToCollection,
    filters,
    applyFilters,
    resetFilters,
    currentView,
    setCurrentView,
    selectedCollectionId,
    selectedTagId,
    selectedFiles,
    setSelectedFiles,
    toggleFileSelection,
    currentlyPlaying,
    playFile,
    modals,
    openModal,
    closeModal,
    detailsPanelFile,
    setDetailsPanelFile,
    updateFileRating,
    contextMenu,
    openContextMenu,
    closeContextMenu,
    handleCollectionClick,
    handleTagClick,
    importFolder,
  } = useAppStore()

  // Debounce timer for search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // View mode state (grid or list)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Verify session on mount
  useEffect(() => {
    verifyAuth()
  }, [verifyAuth])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [])

  // Setup update listeners
  useEffect(() => {
    const unsubChecking = window.electron.updates.onChecking(() => {
      console.log('Checking for updates...')
    })

    const unsubAvailable = window.electron.updates.onAvailable((info) => {
      console.log('Update available:', info)
      setUpdate({
        available: true,
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
        },
        showPopup: true,
      })
    })

    const unsubNotAvailable = window.electron.updates.onNotAvailable(() => {
      console.log('No updates available')
    })

    const unsubProgress = window.electron.updates.onProgress((progress) => {
      setUpdate({
        downloading: true,
        progress: {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        },
      })
    })

    const unsubDownloaded = window.electron.updates.onDownloaded((info) => {
      console.log('Update downloaded:', info)
      setUpdate({ downloading: false, downloaded: true })
    })

    const unsubError = window.electron.updates.onError((error) => {
      console.error('Update error:', error)
      setUpdate({ downloading: false, error: error.message })
    })

    return () => {
      unsubChecking()
      unsubAvailable()
      unsubNotAvailable()
      unsubProgress()
      unsubDownloaded()
      unsubError()
    }
  }, [setUpdate])

  // Debounced search handler
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }

      searchDebounceRef.current = setTimeout(() => {
        searchFiles(query)
      }, 300)
    },
    [setSearchQuery, searchFiles]
  )

  // Define sample and project file types
  const sampleTypes = ['sample', 'one_shot', 'loop']
  const projectTypes = ['project', 'flp', 'midi']

  // Filter files based on current view
  const filteredFiles = files.filter((file) => {
    if (currentView === 'samples' && !sampleTypes.includes(file.file_type)) return false
    if (currentView === 'projects' && !projectTypes.includes(file.file_type)) return false
    if (currentView === 'favorites' && !file.is_favorite) return false
    if (!searchQuery.trim()) return true
    return file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Loading state
  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={login} error={auth.error} />
  }

  if (!auth.hasSubscription) {
    return <SubscriptionRequired email={auth.user?.email || ''} onLogout={logout} />
  }

  const renderToolView = () => {
    switch (currentTool) {
      case 'hub':
        return (
          <HubView
            user={auth.user}
            stats={stats}
            onNavigateSettings={() => setCurrentTool('settings')}
          />
        )
      case 'kickforge':
        return <KickforgeView />
      case 'settings':
        return (
          <SettingsView
            user={auth.user}
            onLogout={logout}
            onCheckUpdates={checkUpdates}
          />
        )
      case 'organizer':
      default:
        return (
          <>
            {/* Sidebar */}
            <OrganizerSidebar
              collections={collections}
              tags={tags}
              currentView={currentView}
              selectedCollectionId={selectedCollectionId}
              selectedTagId={selectedTagId}
              stats={{ totalFiles: stats.totalFiles, totalFavorites: stats.totalFavorites }}
              onViewChange={(view) => {
                setCurrentView(view)
                useAppStore.getState().setSelectedCollectionId(null)
                useAppStore.getState().setSelectedTagId(null)
                loadData()
              }}
              onAddFolder={() => openModal('import')}
              onCollectionClick={handleCollectionClick}
              onTagClick={handleTagClick}
              onCreateCollection={() => openModal('createCollection')}
              onManageTags={() => openModal('tagManagement')}
              onBackToHub={() => setCurrentTool('hub')}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <Toolbar
                fileCount={filteredFiles.length}
                viewMode={viewMode}
                searchValue={searchQuery}
                onViewChange={setViewMode}
                onSearchChange={handleSearch}
                onFilterClick={() => openModal('filterPanel')}
              />

              {/* Library View */}
              <div className="flex-1 overflow-hidden p-4">
                {filteredFiles.length === 0 ? (
                  <EmptyState onAddFolder={() => openModal('import')} currentView={currentView} />
                ) : (
                  <VirtualizedFileGrid
                    files={filteredFiles}
                    selectedFiles={selectedFiles}
                    currentlyPlaying={currentlyPlaying}
                    onFileClick={toggleFileSelection}
                    onFileDoubleClick={playFile}
                    onFavoriteToggle={toggleFavorite}
                    onContextMenu={(e, fileId) => openContextMenu(e.clientX, e.clientY, fileId)}
                    hasMore={hasMoreFiles && !searchQuery.trim()}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={loadMoreFiles}
                  />
                )}
              </div>

              {/* Bottom Actions (if files selected) */}
              {selectedFiles.length > 0 && (
                <div className="p-4 bg-bg-secondary border-t border-bg-hover flex items-center gap-3">
                  <span className="text-sm text-text-secondary">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => openModal('addTags')}>
                    Add Tags
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openModal('addToCollection')}>
                    Add to Collection
                  </Button>
                  <Button size="sm" variant="danger" className="ml-auto" onClick={() => openModal('confirmDelete')}>
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* File Details Panel */}
            <FileDetailsPanel
              isOpen={detailsPanelFile !== null}
              onClose={() => setDetailsPanelFile(null)}
              file={detailsPanelFile}
              isPlaying={detailsPanelFile ? currentlyPlaying === detailsPanelFile.id : false}
              onPlay={() => detailsPanelFile && playFile(detailsPanelFile)}
              onToggleFavorite={async () => {
                if (detailsPanelFile) {
                  await toggleFavorite(detailsPanelFile.id)
                  setDetailsPanelFile({ ...detailsPanelFile, is_favorite: !detailsPanelFile.is_favorite })
                }
              }}
              onUpdateRating={updateFileRating}
              onRemoveTag={async () => {
                console.warn('Tag removal not yet implemented')
              }}
            />

            {/* Import Modal */}
            <ImportModal
              isOpen={modals.import}
              onClose={() => closeModal('import')}
              onImport={importFolder}
            />

            {/* Tag Management Modal */}
            <TagManagementModal
              isOpen={modals.tagManagement}
              onClose={() => closeModal('tagManagement')}
              tags={tags}
              onCreateTag={createTag}
              onDeleteTag={deleteTag}
            />

            {/* Create Collection Modal */}
            <CreateCollectionModal
              isOpen={modals.createCollection}
              onClose={() => closeModal('createCollection')}
              onCreate={createCollection}
            />

            {/* Add Tags Modal */}
            <AddTagsModal
              isOpen={modals.addTags}
              onClose={() => closeModal('addTags')}
              tags={tags}
              selectedFileCount={selectedFiles.length}
              onAddTags={(tagIds) => addTagsToFiles(selectedFiles, tagIds)}
            />

            {/* Add to Collection Modal */}
            <AddToCollectionModal
              isOpen={modals.addToCollection}
              onClose={() => closeModal('addToCollection')}
              collections={collections}
              selectedFileCount={selectedFiles.length}
              onAddToCollection={(collectionId) => addFilesToCollection(collectionId, selectedFiles)}
            />

            {/* Filter Panel */}
            <FilterPanel
              isOpen={modals.filterPanel}
              onClose={() => closeModal('filterPanel')}
              tags={tags}
              filters={filters}
              onApplyFilters={applyFilters}
              onResetFilters={resetFilters}
            />

            {/* Confirm Delete Modal */}
            <ConfirmDeleteModal
              isOpen={modals.confirmDelete}
              onClose={() => closeModal('confirmDelete')}
              fileCount={selectedFiles.length}
              onConfirm={() => deleteFiles(selectedFiles)}
            />

            {/* Context Menu */}
            {contextMenu.isOpen && contextMenu.fileId && (
              <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={closeContextMenu}
                items={createFileContextMenuItems({
                  onPlay: () => {
                    const file = files.find((f) => f.id === contextMenu.fileId)
                    if (file) playFile(file)
                  },
                  onToggleFavorite: () => {
                    if (contextMenu.fileId) toggleFavorite(contextMenu.fileId)
                  },
                  isFavorite: files.find((f) => f.id === contextMenu.fileId)?.is_favorite || false,
                  onAddTags: () => {
                    if (contextMenu.fileId) {
                      setSelectedFiles([contextMenu.fileId])
                      openModal('addTags')
                    }
                  },
                  onAddToCollection: () => {
                    if (contextMenu.fileId) {
                      setSelectedFiles([contextMenu.fileId])
                      openModal('addToCollection')
                    }
                  },
                  onShowDetails: () => {
                    const file = files.find((f) => f.id === contextMenu.fileId)
                    if (file) setDetailsPanelFile(file)
                  },
                  onCopyPath: () => {
                    const file = files.find((f) => f.id === contextMenu.fileId)
                    if (file) navigator.clipboard.writeText(file.file_path)
                  },
                  onDelete: () => {
                    if (contextMenu.fileId) {
                      setSelectedFiles([contextMenu.fileId])
                      openModal('confirmDelete')
                    }
                  },
                })}
              />
            )}
          </>
        )
    }
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {renderToolView()}
      </div>

      {/* Update Popup */}
      {update.showPopup && (
        <UpdatePopup
          updateInfo={update.info}
          isDownloading={update.downloading}
          downloadProgress={update.progress}
          isDownloaded={update.downloaded}
          onDownload={downloadUpdate}
          onInstall={installUpdate}
          onDismiss={dismissUpdate}
        />
      )}

      {/* Global Modals (accessible from Hub) */}
      <ImportModal
        isOpen={modals.import}
        onClose={() => closeModal('import')}
        onImport={importFolder}
      />
      <TagManagementModal
        isOpen={modals.tagManagement}
        onClose={() => closeModal('tagManagement')}
        tags={tags}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
      />
      <CreateCollectionModal
        isOpen={modals.createCollection}
        onClose={() => closeModal('createCollection')}
        onCreate={createCollection}
      />
    </div>
  )
}

function EmptyState({ onAddFolder, currentView }: { onAddFolder: () => void; currentView: string }) {
  const getContent = () => {
    switch (currentView) {
      case 'samples':
        return {
          title: 'No Samples Yet',
          description: 'Add folders containing your audio samples. We\'ll organize kicks, snares, loops, and one-shots with smart tagging.',
          buttonText: 'Add Sample Folder',
          features: [
            { title: 'Smart Tagging', description: 'Auto-tag based on folder names and filenames' },
            { title: 'BPM Detection', description: 'Extract tempo and key from audio files' },
            { title: 'Instant Preview', description: 'Click to preview any sample' },
          ],
        }
      case 'projects':
        return {
          title: 'No Projects Yet',
          description: 'Add folders containing your DAW projects. We\'ll help you organize FLPs, MIDI files, and project stems.',
          buttonText: 'Add Project Folder',
          features: [
            { title: 'Project Files', description: 'Organize FLP, ALS, and other DAW files' },
            { title: 'MIDI Files', description: 'Keep track of your MIDI compositions' },
            { title: 'Version Control', description: 'Track different versions of your projects' },
          ],
        }
      case 'favorites':
        return {
          title: 'No Favorites Yet',
          description: 'Star your most-used samples and projects to quickly access them here.',
          buttonText: 'Browse Your Library',
          features: [
            { title: 'Quick Access', description: 'Your favorite files at your fingertips' },
            { title: 'Star Anything', description: 'Samples, loops, or entire projects' },
            { title: 'Stay Organized', description: 'Keep your go-to sounds ready' },
          ],
        }
      case 'recent':
        return {
          title: 'No Recent Files',
          description: 'Files you\'ve recently accessed will appear here for quick access.',
          buttonText: 'Browse Your Library',
          features: [
            { title: 'Recently Used', description: 'Jump back to files you were working with' },
            { title: 'Quick Access', description: 'No searching needed' },
            { title: 'Auto Updates', description: 'Always shows your latest activity' },
          ],
        }
      default:
        return {
          title: 'No Files Yet',
          description: 'Get started by adding your sample and project folders. We\'ll scan and organize your entire library.',
          buttonText: 'Add Your First Folder',
          features: [
            { title: 'Smart Tagging', description: 'Auto-tag based on folder structure and filename' },
            { title: 'BPM Detection', description: 'Extract BPM and musical key from audio files' },
            { title: 'Fast Search', description: 'Find any file instantly with advanced filters' },
          ],
        }
    }
  }

  const content = getContent()

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-accent-primary to-accent-tertiary opacity-20 mb-6" />

      <h2 className="text-2xl font-bold text-text-primary mb-2">{content.title}</h2>
      <p className="text-text-secondary mb-6 max-w-md">{content.description}</p>

      <Button variant="primary" onClick={onAddFolder}>
        {content.buttonText}
      </Button>

      <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl">
        {content.features.map((feature, i) => (
          <Feature key={i} title={feature.title} description={feature.description} />
        ))}
      </div>
    </div>
  )
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center">
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary">{description}</p>
    </div>
  )
}

export default App
