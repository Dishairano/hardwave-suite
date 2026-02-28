'use client';

import { useEffect, useState, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Card, Button, Modal, Input, Select, Badge, useToast } from '@/components/erp';
import type { AgendaEvent } from '@/lib/erp-types';

const tokens = {
  colors: {
    bgPrimary: '#0a0a0a',
    bgCard: '#18181b',
    bgHover: '#27272a',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    brandPink: '#EC4899',
    brandPurple: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

const EVENT_COLORS = [
  { value: '#EC4899', label: 'Pink' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#EF4444', label: 'Red' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Amber' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ViewMode = 'month' | 'week' | 'list';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatetime(d: Date) {
  return `${formatDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function AgendaPage() {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const { toastError, toastSuccess } = useToast();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formColor, setFormColor] = useState('#EC4899');
  const [formSaving, setFormSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    const token = localStorage.getItem('token');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const start = formatDate(new Date(year, month - 1, 1));
    const end = formatDate(new Date(year, month + 2, 0));

    try {
      const res = await fetch(`/api/erp/agenda?start=${start}&end=${end}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch agenda events:', err);
    }
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const today = new Date();

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const navigateWeek = (delta: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + delta * 7);
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(e => {
      const eventDate = new Date(e.start_datetime);
      return isSameDay(eventDate, date);
    }).sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(e => new Date(e.start_datetime) >= now)
      .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
      .slice(0, 5);
  };

  const openCreateModal = (date?: Date) => {
    setEditingEvent(null);
    const d = date || selectedDate || new Date();
    setFormTitle('');
    setFormDescription('');
    setFormStart(formatDatetime(d));
    setFormEnd('');
    setFormAllDay(false);
    setFormColor('#EC4899');
    setModalOpen(true);
  };

  const openEditModal = (event: AgendaEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setFormStart(event.start_datetime.replace(' ', 'T').slice(0, 16));
    setFormEnd(event.end_datetime ? event.end_datetime.replace(' ', 'T').slice(0, 16) : '');
    setFormAllDay(event.all_day);
    setFormColor(event.color || '#EC4899');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formStart) {
      toastError('Title and start time are required');
      return;
    }
    setFormSaving(true);
    const token = localStorage.getItem('token');

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      start_datetime: formStart.replace('T', ' ') + ':00',
      end_datetime: formEnd ? formEnd.replace('T', ' ') + ':00' : null,
      all_day: formAllDay,
      color: formColor,
    };

    try {
      const url = editingEvent ? `/api/erp/agenda/${editingEvent.id}` : '/api/erp/agenda';
      const method = editingEvent ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setModalOpen(false);
        fetchEvents();
        toastSuccess(editingEvent ? 'Event updated' : 'Event created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to save event');
      }
    } catch (err) {
      console.error('Save event error:', err);
      toastError('Failed to save event');
    }
    setFormSaving(false);
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/agenda/${editingEvent.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setModalOpen(false);
        fetchEvents();
        toastSuccess('Event deleted');
      } else {
        toastError('Failed to delete event');
      }
    } catch (err) {
      console.error('Delete event error:', err);
      toastError('Failed to delete event');
    }
  };

  // ── Month View ──
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const cells: React.ReactNode[] = [];

    // Leading blanks
    for (let i = 0; i < firstDay; i++) {
      cells.push(
        <div key={`blank-${i}`} style={{
          minHeight: 100,
          padding: 8,
          backgroundColor: tokens.colors.bgCard,
          borderRadius: 8,
          opacity: 0.3,
        }} />
      );
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = getEventsForDate(date);
      const isToday = isSameDay(date, today);
      const isSelected = isSameDay(date, selectedDate);

      cells.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          style={{
            minHeight: 100,
            padding: 8,
            borderRadius: 8,
            cursor: 'pointer',
            backgroundColor: isSelected ? '#EC489915' : tokens.colors.bgCard,
            border: isSelected ? '2px solid #EC4899' : '2px solid transparent',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = tokens.colors.bgCard;
            }
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: isToday ? 700 : 500,
              color: isToday ? '#000' : tokens.colors.textPrimary,
              backgroundColor: isToday ? '#EC4899' : 'transparent',
              marginBottom: 4,
            }}
          >
            {day}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dayEvents.slice(0, 3).map((ev) => (
              <div
                key={ev.id}
                onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}
                style={{
                  padding: '4px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: ev.color || '#EC4899',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {ev.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div style={{ fontSize: 10, color: tokens.colors.textMuted, paddingLeft: 6, fontWeight: 500 }}>
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: tokens.colors.textMuted, padding: '8px 0' }}>
              {d}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {cells}
        </div>
      </div>
    );
  };

  // ── Week View ──
  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', minWidth: 900, gap: 1 }}>
          {/* Header row */}
          <div style={{ padding: 12, backgroundColor: tokens.colors.bgCard }} />
          {days.map((d, i) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  padding: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  color: isToday ? '#EC4899' : tokens.colors.textPrimary,
                  backgroundColor: tokens.colors.bgCard,
                  borderBottom: isToday ? '2px solid #EC4899' : 'none',
                }}
              >
                <div style={{ fontSize: 11, color: tokens.colors.textMuted, marginBottom: 4 }}>
                  {DAYS[d.getDay()]}
                </div>
                <div>{d.getDate()}</div>
              </div>
            );
          })}

          {/* Hour rows */}
          {hours.map(hour => (
            <div key={hour} style={{ display: 'contents' }}>
              <div style={{
                padding: '8px 12px',
                fontSize: 12,
                color: tokens.colors.textMuted,
                textAlign: 'right',
                backgroundColor: tokens.colors.bgCard,
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}>
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((d, di) => {
                const dayEvents = getEventsForDate(d).filter(ev => {
                  const h = new Date(ev.start_datetime).getHours();
                  return h === hour;
                });
                return (
                  <div
                    key={di}
                    onClick={() => { setSelectedDate(d); setCurrentDate(d); }}
                    style={{
                      minHeight: 60,
                      backgroundColor: tokens.colors.bgCard,
                      borderBottom: `1px solid ${tokens.colors.border}`,
                      padding: 4,
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = tokens.colors.bgCard;
                    }}
                  >
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); openEditModal(ev); }}
                        style={{
                          padding: '4px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#fff',
                          backgroundColor: ev.color || '#EC4899',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          marginBottom: 2,
                        }}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── List View ──
  const renderListView = () => {
    const upcomingEvents = getUpcomingEvents();

    return (
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 16 }}>
          Upcoming Events
        </h3>
        {upcomingEvents.length === 0 ? (
          <div style={{
            padding: 48,
            textAlign: 'center',
            backgroundColor: tokens.colors.bgCard,
            borderRadius: 12,
            border: `1px dashed ${tokens.colors.border}`,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={tokens.colors.textMuted} strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <p style={{ color: tokens.colors.textMuted, fontSize: 14 }}>
              No upcoming events
            </p>
            <Button onClick={() => openCreateModal()} size="sm" style={{ marginTop: 16 }}>
              Create Event
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {upcomingEvents.map(ev => {
              const start = new Date(ev.start_datetime);
              const timeStr = ev.all_day
                ? 'All day'
                : start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

              return (
                <div
                  key={ev.id}
                  onClick={() => openEditModal(ev)}
                  style={{
                    display: 'flex',
                    gap: 16,
                    padding: 16,
                    backgroundColor: tokens.colors.bgCard,
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: 12,
                    cursor: 'pointer',
                    borderLeft: `4px solid ${ev.color || '#EC4899'}`,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.borderColor = ev.color || '#EC4899';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.borderColor = tokens.colors.border;
                  }}
                >
                  <div style={{
                    minWidth: 80,
                    textAlign: 'center',
                    padding: 12,
                    backgroundColor: `${ev.color || '#EC4899'}20`,
                    borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: ev.color || '#EC4899' }}>
                      {start.getDate()}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.colors.textMuted, textTransform: 'uppercase', marginTop: 4 }}>
                      {MONTHS[start.getMonth()].slice(0, 3)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 4 }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 8 }}>
                      {dateStr} • {timeStr}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize: 13, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Sidebar ──
  const renderSidebar = () => {
    if (isMobile) return null;
    const dayEvents = getEventsForDate(selectedDate);

    return (
      <div style={{
        width: 320,
        backgroundColor: tokens.colors.bgCard,
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {/* Selected Date */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
              {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </h3>
            <Button size="sm" onClick={() => openCreateModal(selectedDate)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </Button>
          </div>
          {dayEvents.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              backgroundColor: `${tokens.colors.border}50`,
              borderRadius: 8,
              border: `1px dashed ${tokens.colors.border}`,
            }}>
              <p style={{ fontSize: 13, color: tokens.colors.textMuted, margin: 0 }}>
                No events scheduled
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEvents.map(ev => {
                const start = new Date(ev.start_datetime);
                const timeStr = ev.all_day ? 'All day' : start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <div
                    key={ev.id}
                    onClick={() => openEditModal(ev)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: `${ev.color || '#EC4899'}15`,
                      borderLeft: `3px solid ${ev.color || '#EC4899'}`,
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 4 }}>
                      {ev.title}
                    </div>
                    <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
                      {timeStr}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Events Summary */}
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, marginBottom: 12 }}>
            Upcoming
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {getUpcomingEvents().slice(0, 3).map(ev => {
              const start = new Date(ev.start_datetime);
              return (
                <div
                  key={ev.id}
                  onClick={() => openEditModal(ev)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    backgroundColor: tokens.colors.bgHover,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${ev.color || '#EC4899'}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = tokens.colors.bgHover;
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: tokens.colors.textPrimary, marginBottom: 2 }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>
                    {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0, marginBottom: 4 }}>
            Agenda
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: 0 }}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View switcher */}
          <div style={{
            display: 'flex',
            backgroundColor: tokens.colors.bgCard,
            borderRadius: 8,
            padding: 4,
            border: `1px solid ${tokens.colors.border}`,
          }}>
            {(['month', 'week', 'list'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: view === v ? '#EC4899' : 'transparent',
                  color: view === v ? '#000' : tokens.colors.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Navigation */}
          {view !== 'list' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => view === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => view === 'month' ? navigateMonth(1) : navigateWeek(1)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Button>
            </div>
          )}

          {/* Create button */}
          <Button onClick={() => openCreateModal()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Event
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 120,
              backgroundColor: tokens.colors.bgCard,
              borderRadius: 12,
            }}>
              <div style={{
                width: 40,
                height: 40,
                border: `3px solid ${tokens.colors.border}`,
                borderTopColor: '#EC4899',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{
              backgroundColor: tokens.colors.bgCard,
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${tokens.colors.border}`,
            }}>
              {view === 'month' && renderMonthView()}
              {view === 'week' && renderWeekView()}
              {view === 'list' && renderListView()}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {view !== 'list' && renderSidebar()}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        footer={
          <>
            {editingEvent && (
              <Button variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={formSaving}>
              {editingEvent ? 'Save Changes' : 'Create Event'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Title"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Event title"
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Start"
              type={formAllDay ? 'date' : 'datetime-local'}
              value={formAllDay ? formStart.slice(0, 10) : formStart}
              onChange={(e) => setFormStart(e.target.value)}
              required
            />
            <Input
              label="End"
              type={formAllDay ? 'date' : 'datetime-local'}
              value={formAllDay ? formEnd.slice(0, 10) : formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formAllDay}
              onChange={(e) => setFormAllDay(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: tokens.colors.textSecondary }}>All day event</span>
          </label>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 8 }}>
              Color
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EVENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setFormColor(c.value)}
                  title={c.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: c.value,
                    border: formColor === c.value ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer',
                    outline: formColor === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: 2,
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: tokens.colors.textSecondary, marginBottom: 8 }}>
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
              style={{
                width: '100%',
                minHeight: 100,
                padding: 12,
                backgroundColor: tokens.colors.bgPrimary,
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: 8,
                color: tokens.colors.textPrimary,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
