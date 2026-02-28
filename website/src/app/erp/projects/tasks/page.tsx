'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  KanbanBoard, KanbanCard, Button, Modal, Input, Select, Textarea, Card, useToast,
  ContextMenu, ConfirmDialog,
} from '@/components/erp';
import type { KanbanColumn } from '@/components/erp/KanbanBoard';
import type { ContextMenuEntry } from '@/components/erp/ContextMenu';
import type { Task, TaskStatus, TaskPriority, Project } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandBlue: '#3B82F6',
    brandPurple: '#8B5CF6',
    brandGreen: '#00FF00',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: '#6B7280' },
  todo: { label: 'To Do', color: '#3B82F6' },
  in_progress: { label: 'In Progress', color: '#F59E0B' },
  review: { label: 'Review', color: '#8B5CF6' },
  done: { label: 'Done', color: '#10B981' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6B7280' },
  medium: { label: 'Medium', color: '#3B82F6' },
  high: { label: 'High', color: '#F59E0B' },
  urgent: { label: 'Urgent', color: '#EF4444' },
};

const taskTypeLabels: Record<string, { label: string; color: string }> = {
  feature: { label: 'Feature', color: '#10B981' },
  bug: { label: 'Bug', color: '#EF4444' },
  improvement: { label: 'Improvement', color: '#3B82F6' },
  task: { label: 'Task', color: '#8B5CF6' },
  research: { label: 'Research', color: '#F59E0B' },
};

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default function TasksKanbanPage() {
  const { toastError, toastSuccess } = useToast();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [createInColumn, setCreateInColumn] = useState<TaskStatus>('todo');

  // Permissions
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [canDelete, setCanDelete] = useState(false);

  // Live polling
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    task_type: 'task',
    estimated_hours: '',
    due_date: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    task_type: 'task',
    estimated_hours: '',
    due_date: '',
  });

  const fetchPermissions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/auth/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUserId(data.userId);
        const projectPerms: string[] = data.permissions?.projects || [];
        setCanDelete(data.isAdmin || projectPerms.includes('delete'));
      }
    } catch {
      // non-critical
    }
  };

  const fetchProjects = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/projects?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items);
        if (!selectedProjectId && data.items.length > 0) {
          setSelectedProjectId(data.items[0].id.toString());
        }
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchTasks = useCallback(async (silent = false) => {
    if (!selectedProjectId) return;

    if (!silent) setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/tasks?project_id=${selectedProjectId}&limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTasks(data.items);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }

    if (!silent) setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => {
    fetchPermissions();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks();
    }
  }, [selectedProjectId, fetchTasks]);

  // Live polling — 10s interval, pauses when tab is hidden
  useEffect(() => {
    if (!selectedProjectId) return;

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (!document.hidden) fetchTasks(true);
      }, 5_000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        fetchTasks(true);
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedProjectId, fetchTasks]);

  const handleDragEnd = async (task: Task, sourceColumn: string, targetColumn: string, targetIndex: number) => {
    const token = localStorage.getItem('token');

    if (sourceColumn === targetColumn) {
      // Same-column reorder
      const columnTasks = tasks
        .filter((t) => t.status === sourceColumn)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const fromIndex = columnTasks.findIndex((t) => t.id === task.id);
      if (fromIndex === -1 || fromIndex === targetIndex) return;

      const reordered = [...columnTasks];
      reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, task);

      // Optimistic update — assign sequential sort_orders
      setTasks((prev) =>
        prev.map((t) => {
          if (t.status !== sourceColumn) return t;
          const idx = reordered.findIndex((r) => r.id === t.id);
          return idx !== -1 ? { ...t, sort_order: idx } : t;
        })
      );

      // Persist all new sort_orders in the column
      try {
        await Promise.all(
          reordered.map((t, i) =>
            fetch(`/api/erp/projects/tasks/${t.id}`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ sort_order: i }),
            })
          )
        );
      } catch (error) {
        console.error('Failed to reorder tasks:', error);
        fetchTasks();
      }
      return;
    }

    // Cross-column move — update status + sort_order
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: targetColumn as TaskStatus } : t
      )
    );

    try {
      await fetch(`/api/erp/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: targetColumn,
          sort_order: targetIndex,
        }),
      });
    } catch (error) {
      console.error('Failed to update task status:', error);
      fetchTasks();
    }
  };

  const handleCreateTask = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/projects/tasks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: parseInt(selectedProjectId),
          status: createInColumn,
          ...newTask,
          estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : 0,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          task_type: 'task',
          estimated_hours: '',
          due_date: '',
        });
        fetchTasks();
        toastSuccess('Task created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Create task error:', error);
      toastError('Failed to create task');
    }

    setCreating(false);
  };

  const handleAddItem = (columnId: string) => {
    setCreateInColumn(columnId as TaskStatus);
    setShowCreateModal(true);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  // Context menu
  const handleContextMenu = (task: Task, event: React.MouseEvent) => {
    setContextMenu({ task, x: event.clientX, y: event.clientY });
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      task_type: task.task_type,
      estimated_hours: task.estimated_hours ? String(task.estimated_hours) : '',
      due_date: task.due_date ? String(task.due_date).split('T')[0] : '',
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingTask) return;
    setEditSaving(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...editForm,
          estimated_hours: editForm.estimated_hours ? parseFloat(editForm.estimated_hours) : 0,
          due_date: editForm.due_date || null,
        }),
      });

      if (res.ok) {
        toastSuccess('Task updated');
        setShowEditModal(false);
        setEditingTask(null);
        fetchTasks();
      } else {
        const err = await res.json();
        toastError(err.error || 'Failed to update task');
      }
    } catch {
      toastError('Failed to update task');
    }

    setEditSaving(false);
  };

  const confirmDelete = (task: Task) => {
    setTaskToDelete(task);
    setShowDeleteConfirm(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/projects/tasks/${taskToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toastSuccess('Task deleted');
        setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
      } else {
        const err = await res.json();
        toastError(err.error || 'Failed to delete task');
      }
    } catch {
      toastError('Failed to delete task');
    }

    setDeleting(false);
  };

  // Build context menu items for a given task
  const buildContextMenuItems = (task: Task): ContextMenuEntry[] => {
    const items: ContextMenuEntry[] = [
      {
        label: 'View details',
        icon: <InfoIcon />,
        onClick: () => handleTaskClick(task),
      },
    ];

    const isOwner = currentUserId !== null && task.reporter_id === currentUserId;

    if (isOwner) {
      items.push({ separator: true });
      items.push({
        label: 'Edit task',
        icon: <EditIcon />,
        onClick: () => openEditModal(task),
      });
    }

    if (canDelete) {
      if (!isOwner) items.push({ separator: true });
      items.push({
        label: 'Delete task',
        icon: <TrashIcon />,
        danger: true,
        onClick: () => confirmDelete(task),
      });
    }

    return items;
  };

  // Build Kanban columns
  const columns: KanbanColumn<Task>[] = [
    { id: 'backlog', title: statusConfig.backlog.label, color: statusConfig.backlog.color, items: [] },
    { id: 'todo', title: statusConfig.todo.label, color: statusConfig.todo.color, items: [] },
    { id: 'in_progress', title: statusConfig.in_progress.label, color: statusConfig.in_progress.color, items: [] },
    { id: 'review', title: statusConfig.review.label, color: statusConfig.review.color, items: [] },
    { id: 'done', title: statusConfig.done.label, color: statusConfig.done.color, items: [] },
  ];

  tasks.forEach((task) => {
    const column = columns.find((c) => c.id === task.status);
    if (column) column.items.push(task);
  });

  columns.forEach((column) => {
    column.items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  const renderTaskCard = (task: Task) => (
    <KanbanCard
      title={task.title}
      subtitle={task.task_number}
      labels={[
        { text: taskTypeLabels[task.task_type]?.label || task.task_type, color: taskTypeLabels[task.task_type]?.color || '#6B7280' },
      ]}
      priority={task.priority}
      dueDate={task.due_date ? new Date(task.due_date).toLocaleDateString() : undefined}
      assignee={task.assignee_name ? { name: task.assignee_name } : undefined}
      progress={
        task.estimated_hours && task.actual_hours
          ? Math.min(100, Math.round((task.actual_hours / task.estimated_hours) * 100))
          : undefined
      }
      onClick={() => handleTaskClick(task)}
    />
  );

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Task Board
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: 0 }}>
              Drag and drop tasks to update status · Right-click for options
            </p>
            {selectedProjectId && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: tokens.colors.textMuted }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    display: 'inline-block',
                    boxShadow: '0 0 0 0 rgba(16,185,129,0.4)',
                    animation: 'livePulse 2s ease-in-out infinite',
                  }}
                />
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : 'Live'}
              </span>
            )}
          </div>
          <style>{`
            @keyframes livePulse {
              0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
              70%  { box-shadow: 0 0 0 5px rgba(16,185,129,0); }
              100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
            }
          `}</style>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#101018',
              color: '#a1a1aa',
              fontSize: 14,
              cursor: 'pointer',
              minWidth: 200,
            }}
          >
            <option value="">Select Project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_code} - {p.name}
              </option>
            ))}
          </select>
          <Button onClick={() => handleAddItem('todo')} disabled={!selectedProjectId}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      {selectedProjectId ? (
        <KanbanBoard
          columns={columns}
          onDragEnd={handleDragEnd}
          renderCard={renderTaskCard}
          itemKey={(task) => task.id}
          onAddItem={handleAddItem}
          onContextMenu={handleContextMenu}
          loading={loading}
          columnWidth={300}
        />
      ) : (
        <Card>
          <div style={{ padding: 48, textAlign: 'center' }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.colors.textMuted}
              strokeWidth="1"
              style={{ margin: '0 auto 16px' }}
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h3 style={{ fontSize: 16, color: tokens.colors.textPrimary, marginBottom: 8 }}>
              Select a Project
            </h3>
            <p style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              Choose a project from the dropdown above to view its tasks
            </p>
          </div>
        </Card>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.task)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Task"
        description={`Creating task in "${statusConfig[createInColumn]?.label}" column`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} loading={creating} disabled={!newTask.title}>
              Create Task
            </Button>
          </>
        }
      >
        <Input
          label="Task Title"
          required
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          placeholder="Enter task title"
        />

        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Priority"
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
            options={Object.entries(priorityConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          <Select
            label="Type"
            value={newTask.task_type}
            onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
            options={Object.entries(taskTypeLabels).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          <Input
            label="Estimated Hours"
            type="number"
            value={newTask.estimated_hours}
            onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
            placeholder="0"
          />

          <Input
            label="Due Date"
            type="date"
            value={newTask.due_date}
            onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
          />
        </div>

        <Textarea
          label="Description"
          value={newTask.description}
          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
          placeholder="Describe the task..."
        />
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingTask(null); }}
        title="Edit Task"
        description={editingTask?.task_number}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingTask(null); }}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} loading={editSaving} disabled={!editForm.title}>
              Save Changes
            </Button>
          </>
        }
      >
        <Input
          label="Task Title"
          required
          value={editForm.title}
          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Status"
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as TaskStatus })}
            options={Object.entries(statusConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          <Select
            label="Priority"
            value={editForm.priority}
            onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as TaskPriority })}
            options={Object.entries(priorityConfig).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          <Select
            label="Type"
            value={editForm.task_type}
            onChange={(e) => setEditForm({ ...editForm, task_type: e.target.value })}
            options={Object.entries(taskTypeLabels).map(([value, config]) => ({
              value,
              label: config.label,
            }))}
          />

          <Input
            label="Estimated Hours"
            type="number"
            value={editForm.estimated_hours}
            onChange={(e) => setEditForm({ ...editForm, estimated_hours: e.target.value })}
            placeholder="0"
          />

          <Input
            label="Due Date"
            type="date"
            value={editForm.due_date}
            onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
          />
        </div>

        <Textarea
          label="Description"
          value={editForm.description}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          placeholder="Describe the task..."
        />
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        title={selectedTask?.title || 'Task Details'}
        description={selectedTask?.task_number}
        size="lg"
      >
        {selectedTask && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  backgroundColor: `${statusConfig[selectedTask.status]?.color}20`,
                  color: statusConfig[selectedTask.status]?.color,
                }}
              >
                {statusConfig[selectedTask.status]?.label}
              </span>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  backgroundColor: `${priorityConfig[selectedTask.priority]?.color}20`,
                  color: priorityConfig[selectedTask.priority]?.color,
                }}
              >
                {priorityConfig[selectedTask.priority]?.label}
              </span>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  backgroundColor: `${taskTypeLabels[selectedTask.task_type]?.color}20`,
                  color: taskTypeLabels[selectedTask.task_type]?.color,
                }}
              >
                {taskTypeLabels[selectedTask.task_type]?.label}
              </span>
            </div>

            {selectedTask.description && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 8 }}>Description</h4>
                <p style={{ fontSize: 14, color: tokens.colors.textSecondary, whiteSpace: 'pre-wrap' }}>
                  {selectedTask.description}
                </p>
              </div>
            )}

            <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>Assignee</h4>
                <p style={{ fontSize: 14, color: tokens.colors.textPrimary }}>
                  {selectedTask.assignee_name || 'Unassigned'}
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>Reporter</h4>
                <p style={{ fontSize: 14, color: tokens.colors.textPrimary }}>
                  {selectedTask.reporter_name || '-'}
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>Due Date</h4>
                <p style={{ fontSize: 14, color: tokens.colors.textPrimary }}>
                  {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'Not set'}
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>Hours</h4>
                <p style={{ fontSize: 14, color: tokens.colors.textPrimary }}>
                  {Number(selectedTask.actual_hours || 0).toFixed(1)} / {Number(selectedTask.estimated_hours || 0).toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setTaskToDelete(null); }}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  );
}
