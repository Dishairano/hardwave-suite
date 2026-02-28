'use client';

import { useState, useEffect, useCallback } from 'react';

const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgElevated: '#0c0c12',
    bgCard: '#101018',
    bgHover: '#14141c',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandOrange: '#FFA500',
    brandGreen: '#00FF00',
    brandTurquoise: '#40E0D0',
    success: '#10B981',
    error: '#EF4444',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

interface TimeTrackerProps {
  isRunning?: boolean;
  startTime?: Date;
  projectId?: number;
  projectName?: string;
  taskId?: number;
  taskTitle?: string;
  description?: string;
  onStart?: (data: { projectId?: number; taskId?: number; description: string }) => Promise<void>;
  onStop?: () => Promise<void>;
  onDescriptionChange?: (description: string) => void;
  projects?: Array<{ id: number; name: string }>;
  tasks?: Array<{ id: number; title: string; project_id: number }>;
  compact?: boolean;
}

export function TimeTracker({
  isRunning = false,
  startTime,
  projectId,
  projectName,
  taskId,
  taskTitle,
  description = '',
  onStart,
  onStop,
  onDescriptionChange,
  projects = [],
  tasks = [],
  compact = false,
}: TimeTrackerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [localDescription, setLocalDescription] = useState(description);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(taskId);
  const [loading, setLoading] = useState(false);

  // Calculate elapsed time
  useEffect(() => {
    if (!isRunning || !startTime) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onStart?.({
        projectId: selectedProjectId,
        taskId: selectedTaskId,
        description: localDescription,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onStop?.();
    } finally {
      setLoading(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    onDescriptionChange?.(value);
  };

  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.project_id === selectedProjectId)
    : tasks;

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          backgroundColor: isRunning ? `${tokens.colors.success}15` : tokens.colors.bgCard,
          borderRadius: tokens.radius.md,
          border: `1px solid ${isRunning ? `${tokens.colors.success}30` : tokens.colors.borderSubtle}`,
        }}
      >
        {isRunning && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: tokens.colors.success,
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }}
          />
        )}
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: 600,
            color: isRunning ? tokens.colors.success : tokens.colors.textMuted,
          }}
        >
          {formatTime(elapsed)}
        </span>
        <button
          onClick={isRunning ? handleStop : handleStart}
          disabled={loading}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isRunning ? tokens.colors.error : tokens.colors.success,
            color: '#fff',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isRunning ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.lg,
        border: `1px solid ${isRunning ? `${tokens.colors.success}30` : tokens.colors.borderSubtle}`,
        overflow: 'hidden',
      }}
    >
      {/* Timer Display */}
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: isRunning ? `${tokens.colors.success}08` : 'transparent',
          borderBottom: `1px solid ${tokens.colors.borderSubtle}`,
        }}
      >
        {isRunning && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: tokens.colors.success,
                animation: 'pulse-dot 1.5s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 12, color: tokens.colors.success, fontWeight: 500 }}>
              TRACKING
            </span>
          </div>
        )}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 48,
            fontWeight: 700,
            color: isRunning ? tokens.colors.success : tokens.colors.textPrimary,
            letterSpacing: '0.05em',
          }}
        >
          {formatTime(elapsed)}
        </div>
        {isRunning && projectName && (
          <div style={{ marginTop: 8, fontSize: 14, color: tokens.colors.textMuted }}>
            {projectName}
            {taskTitle && <span style={{ color: tokens.colors.textFaint }}> / {taskTitle}</span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 24px' }}>
        {!isRunning && (
          <>
            {/* Description Input */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="What are you working on?"
                value={localDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: tokens.radius.md,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: tokens.colors.bgElevated,
                  color: tokens.colors.textPrimary,
                  fontSize: 14,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.brandTurquoise + '50';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
                }}
              />
            </div>

            {/* Project & Task Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <select
                value={selectedProjectId || ''}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value ? parseInt(e.target.value) : undefined);
                  setSelectedTaskId(undefined);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: tokens.radius.default,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: tokens.colors.bgElevated,
                  color: tokens.colors.textSecondary,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedTaskId || ''}
                onChange={(e) => setSelectedTaskId(e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={!selectedProjectId}
                style={{
                  padding: '10px 12px',
                  borderRadius: tokens.radius.default,
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  backgroundColor: tokens.colors.bgElevated,
                  color: tokens.colors.textSecondary,
                  fontSize: 13,
                  cursor: selectedProjectId ? 'pointer' : 'not-allowed',
                  opacity: selectedProjectId ? 1 : 0.5,
                }}
              >
                <option value="">Select Task (optional)</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Start/Stop Button */}
        <button
          onClick={isRunning ? handleStop : handleStart}
          disabled={loading || (!isRunning && !selectedProjectId)}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: tokens.radius.md,
            border: 'none',
            backgroundColor: isRunning ? tokens.colors.error : tokens.colors.success,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: loading || (!isRunning && !selectedProjectId) ? 'not-allowed' : 'pointer',
            opacity: loading || (!isRunning && !selectedProjectId) ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${isRunning ? tokens.colors.error : tokens.colors.success}40`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {isRunning ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop Timer
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Timer
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Mini time entry display
export function TimeEntryRow({
  description,
  project,
  task,
  duration,
  startTime,
  billable,
  onClick,
}: {
  description?: string;
  project?: string;
  task?: string;
  duration: number; // minutes
  startTime: string;
  billable?: boolean;
  onClick?: () => void;
}) {
  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 16px',
        backgroundColor: tokens.colors.bgCard,
        borderRadius: tokens.radius.md,
        border: `1px solid ${tokens.colors.borderSubtle}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.borderColor = tokens.colors.borderDefault;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = tokens.colors.borderSubtle;
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: tokens.colors.textPrimary, marginBottom: 4 }}>
          {description || 'No description'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {project && (
            <span style={{ fontSize: 12, color: tokens.colors.brandTurquoise }}>{project}</span>
          )}
          {task && (
            <>
              <span style={{ color: tokens.colors.textFaint }}>/</span>
              <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>{task}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
          {formatDuration(duration)}
        </div>
        <div style={{ fontSize: 12, color: tokens.colors.textFaint }}>{startTime}</div>
      </div>
      {billable !== undefined && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: billable ? tokens.colors.success : tokens.colors.textFaint,
          }}
          title={billable ? 'Billable' : 'Non-billable'}
        />
      )}
    </div>
  );
}
