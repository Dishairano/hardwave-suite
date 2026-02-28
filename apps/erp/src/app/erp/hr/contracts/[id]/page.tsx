'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Badge, Textarea, Modal, useToast } from '@/components/erp';
import type { HRContract, HRContractAuditLog } from '@/lib/erp-types';

const tokens = {
  colors: {
    bgPrimary: '#08080c',
    bgCard: '#101018',
    bgElevated: '#0c0c12',
    bgHover: '#14141c',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textFaint: '#52525b',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    brandTurquoise: '#40E0D0',
    brandPurple: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  radius: { sm: 4, default: 6, md: 8, lg: 12 },
};

const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
  draft: 'default',
  pending_internal: 'warning',
  pending_external: 'info',
  completed: 'success',
  revoked: 'error',
  expired: 'error',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_internal: 'Pending Internal',
  pending_external: 'Pending External',
  completed: 'Completed',
  revoked: 'Revoked',
  expired: 'Expired',
};

type MarkerKey = 'internal_signature' | 'internal_date' | 'external_signature' | 'external_date';

interface MarkerPosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const MARKER_DEFAULTS: Record<MarkerKey, { width: number; height: number; label: string; color: string }> = {
  internal_signature: { width: 180, height: 50, label: 'Int. Signature', color: '#3B82F6' },
  internal_date: { width: 120, height: 16, label: 'Int. Date', color: '#60A5FA' },
  external_signature: { width: 180, height: 50, label: 'Ext. Signature', color: '#8B5CF6' },
  external_date: { width: 120, height: 16, label: 'Ext. Date', color: '#A78BFA' },
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [contract, setContract] = useState<HRContract & { audit_log?: HRContractAuditLog[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sending, setSending] = useState(false);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureEmpty, setSignatureEmpty] = useState(true);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  // PDF position picker state
  const [pdfPages, setPdfPages] = useState<HTMLCanvasElement[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfScale, setPdfScale] = useState(1);
  const [pdfPageSizes, setPdfPageSizes] = useState<{ width: number; height: number }[]>([]);
  const [markers, setMarkers] = useState<Partial<Record<MarkerKey, MarkerPosition>>>({});
  const [activeMarker, setActiveMarker] = useState<MarkerKey | null>(null);
  const [draggingMarker, setDraggingMarker] = useState<MarkerKey | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [savingPositions, setSavingPositions] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchContract();
  }, [resolvedParams.id]);

  // Load PDF when contract loads and has a document_url
  useEffect(() => {
    if (contract?.document_url && contract.status === 'draft') {
      loadPdf(contract.document_url);
    }
  }, [contract?.document_url, contract?.status]);

  // Initialize markers from saved positions
  useEffect(() => {
    if (contract?.signature_positions) {
      const pos = typeof contract.signature_positions === 'string'
        ? JSON.parse(contract.signature_positions)
        : contract.signature_positions;
      setMarkers(pos || {});
    }
  }, [contract?.signature_positions]);

  const fetchContract = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setContract(await res.json());
      } else {
        toastError('Failed to load contract');
      }
    } catch {
      toastError('Failed to load contract');
    }
    setLoading(false);
  };

  const loadPdf = async (url: string) => {
    setPdfLoading(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      const pages: HTMLCanvasElement[] = [];
      const sizes: { width: number; height: number }[] = [];

      // Determine scale to fit ~700px width
      const firstPage = await pdf.getPage(1);
      const viewport0 = firstPage.getViewport({ scale: 1 });
      const scale = 700 / viewport0.width;
      setPdfScale(scale);

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d')!;
        await page.render({ canvasContext: context, viewport }).promise;
        pages.push(canvas);
        // Store the actual PDF page size (unscaled) for coordinate mapping
        sizes.push({ width: viewport0.width, height: page.getViewport({ scale: 1 }).height });
      }

      setPdfPages(pages);
      setPdfPageSizes(sizes);
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
    setPdfLoading(false);
  };

  // Handle clicking on a PDF page to place the active marker
  const handlePdfPageClick = (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!activeMarker || draggingMarker) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert from display coords to PDF coords (unscaled)
    const pdfX = clickX / pdfScale;
    const pdfY = clickY / pdfScale;

    const defaults = MARKER_DEFAULTS[activeMarker];
    setMarkers(prev => ({
      ...prev,
      [activeMarker]: {
        page: pageIndex,
        x: pdfX,
        y: pdfY,
        width: defaults.width,
        height: defaults.height,
      },
    }));
  };

  // Drag handling
  const handleMarkerMouseDown = (e: React.MouseEvent, key: MarkerKey) => {
    e.stopPropagation();
    e.preventDefault();
    const marker = markers[key];
    if (!marker) return;
    const rect = (e.target as HTMLElement).closest('[data-page-container]')?.getBoundingClientRect();
    if (!rect) return;
    setDraggingMarker(key);
    setDragOffset({
      x: e.clientX - (rect.left + marker.x * pdfScale),
      y: e.clientY - (rect.top + marker.y * pdfScale),
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingMarker) return;
    const container = pdfContainerRef.current;
    if (!container) return;

    // Find the page container the mouse is over
    const pageContainers = container.querySelectorAll('[data-page-container]');
    for (let i = 0; i < pageContainers.length; i++) {
      const rect = pageContainers[i].getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const newX = (e.clientX - rect.left - dragOffset.x) / pdfScale;
        const newY = (e.clientY - rect.top - dragOffset.y) / pdfScale;
        setMarkers(prev => ({
          ...prev,
          [draggingMarker]: {
            ...prev[draggingMarker]!,
            page: i,
            x: Math.max(0, newX),
            y: Math.max(0, newY),
          },
        }));
        break;
      }
    }
  }, [draggingMarker, dragOffset, pdfScale]);

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null);
  }, []);

  useEffect(() => {
    if (draggingMarker) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingMarker, handleMouseMove, handleMouseUp]);

  const handleSavePositions = async () => {
    setSavingPositions(true);
    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature_positions: markers }),
      });
      if (res.ok) {
        toastSuccess('Signature positions saved');
        fetchContract();
      } else {
        const data = await res.json();
        toastError(data.error || 'Failed to save positions');
      }
    } catch {
      toastError('Failed to save positions');
    }
    setSavingPositions(false);
  };

  const removeMarker = (key: MarkerKey) => {
    setMarkers(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Canvas setup
  const initCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      context.strokeStyle = '#000000';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      setCtx(context);
      setSignatureEmpty(true);
    }, 100);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx) return;
    setIsDrawing(true);
    setSignatureEmpty(false);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!ctx) return;
    setIsDrawing(false);
    ctx.closePath();
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureEmpty(true);
  };

  const handleSign = async () => {
    if (!canvasRef.current || signatureEmpty) return;
    setSigning(true);
    const signatureData = canvasRef.current.toDataURL('image/png');

    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}/sign-internal`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature_data: signatureData }),
      });

      if (res.ok) {
        toastSuccess('Contract signed successfully');
        setShowSignModal(false);
        fetchContract();
      } else {
        const data = await res.json();
        toastError(data.error || 'Failed to sign');
      }
    } catch {
      toastError('Failed to sign contract');
    }
    setSigning(false);
  };

  const handleSendExternal = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}/send-external`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        toastSuccess('Contract sent to external party');
        fetchContract();
      } else {
        const data = await res.json();
        toastError(data.error || 'Failed to send');
      }
    } catch {
      toastError('Failed to send contract');
    }
    setSending(false);
  };

  const handleReminder = async () => {
    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}/send-reminder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        toastSuccess('Reminder sent');
        fetchContract();
      } else {
        const data = await res.json();
        toastError(data.error || 'Failed to send reminder');
      }
    } catch {
      toastError('Failed to send reminder');
    }
  };

  const handleRevoke = async () => {
    if (!revokeReason.trim()) {
      toastError('Please provide a reason');
      return;
    }
    setRevoking(true);
    try {
      const res = await fetch(`/api/erp/hr/contracts/${resolvedParams.id}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: revokeReason }),
      });

      if (res.ok) {
        toastSuccess('Contract revoked');
        setShowRevokeModal(false);
        setRevokeReason('');
        fetchContract();
      } else {
        const data = await res.json();
        toastError(data.error || 'Failed to revoke');
      }
    } catch {
      toastError('Failed to revoke contract');
    }
    setRevoking(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingTop: 48, textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32,
          border: `3px solid ${tokens.colors.borderSubtle}`,
          borderTopColor: tokens.colors.brandTurquoise,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto',
        }} />
        <p style={{ color: tokens.colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading contract...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!contract) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', paddingTop: 48, textAlign: 'center' }}>
        <p style={{ color: tokens.colors.textMuted, fontSize: 16 }}>Contract not found</p>
        <Button variant="secondary" onClick={() => router.push('/erp/hr/contracts')} style={{ marginTop: 16 }}>
          Back to Contracts
        </Button>
      </div>
    );
  }

  const canSignInternally = !contract.internal_signed_at && contract.status !== 'completed' && contract.status !== 'revoked';
  const canSendToExternal = !!contract.internal_signed_at && !contract.sent_to_external_at && contract.status !== 'completed' && contract.status !== 'revoked';
  const canSendReminder = contract.status === 'pending_external' && (contract.reminder_count || 0) < 3;
  const canRevoke = contract.status !== 'completed' && contract.status !== 'revoked';
  const showPositionPicker = contract.status === 'draft' && contract.document_url;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/erp/hr/contracts')}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: tokens.radius.default, border: `1px solid ${tokens.colors.borderSubtle}`,
              backgroundColor: 'transparent', color: tokens.colors.textMuted, cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
                {contract.title}
              </h1>
              <Badge variant={statusColors[contract.status] || 'default'}>
                {statusLabels[contract.status] || contract.status}
              </Badge>
            </div>
            <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
              {contract.description || 'No description'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {canSignInternally && (
            <Button onClick={() => { setShowSignModal(true); initCanvas(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Sign Internally
            </Button>
          )}
          {canSendToExternal && (
            <Button onClick={handleSendExternal} loading={sending}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Send Document
            </Button>
          )}
          {canSendReminder && (
            <Button variant="secondary" onClick={handleReminder}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Send Reminder
            </Button>
          )}
          {canRevoke && (
            <Button variant="danger" onClick={() => setShowRevokeModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Revoke
            </Button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left: Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Contract Info */}
          <Card title="Contract Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <InfoField label="Document Type" value={
                contract.document_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              } />
              <InfoField label="Entity Type" value={
                contract.entity_type.charAt(0).toUpperCase() + contract.entity_type.slice(1)
              } />
              <InfoField label="Created" value={new Date(contract.created_at).toLocaleDateString()} />
              <InfoField label="Created By" value={contract.created_by_name || '-'} />
            </div>
          </Card>

          {/* Signing Info */}
          <Card title="Signing Status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Internal */}
              <div style={{
                padding: 16, borderRadius: tokens.radius.md,
                border: `1px solid ${contract.internal_signed_at ? 'rgba(16, 185, 129, 0.3)' : tokens.colors.borderSubtle}`,
                backgroundColor: contract.internal_signed_at ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={contract.internal_signed_at ? tokens.colors.success : tokens.colors.textFaint} strokeWidth="2">
                    {contract.internal_signed_at
                      ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                      : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                    }
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
                    Internal Signer
                  </span>
                </div>
                <p style={{ fontSize: 13, color: tokens.colors.textSecondary, margin: 0 }}>
                  {contract.internal_signer_name || 'Not assigned'}
                </p>
                {contract.internal_signer_email && (
                  <p style={{ fontSize: 12, color: tokens.colors.textMuted, margin: '2px 0 0' }}>
                    {contract.internal_signer_email}
                  </p>
                )}
                <p style={{ fontSize: 12, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                  {contract.internal_signed_at
                    ? `Signed on ${new Date(contract.internal_signed_at).toLocaleDateString()}`
                    : 'Not signed yet'}
                </p>
              </div>

              {/* External */}
              <div style={{
                padding: 16, borderRadius: tokens.radius.md,
                border: `1px solid ${contract.external_signed_at ? 'rgba(16, 185, 129, 0.3)' : tokens.colors.borderSubtle}`,
                backgroundColor: contract.external_signed_at ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={contract.external_signed_at ? tokens.colors.success : tokens.colors.textFaint} strokeWidth="2">
                    {contract.external_signed_at
                      ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>
                      : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
                    }
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
                    External Signer
                  </span>
                </div>
                <p style={{ fontSize: 13, color: tokens.colors.textSecondary, margin: 0 }}>
                  {contract.external_signer_name}
                </p>
                <p style={{ fontSize: 12, color: tokens.colors.textMuted, margin: '2px 0 0' }}>
                  {contract.external_signer_email}
                </p>
                <p style={{ fontSize: 12, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
                  {contract.external_signed_at
                    ? `Signed on ${new Date(contract.external_signed_at).toLocaleDateString()}`
                    : contract.sent_to_external_at
                    ? `Sent on ${new Date(contract.sent_to_external_at).toLocaleDateString()}`
                    : 'Not sent yet'}
                </p>
                {contract.status === 'pending_external' && (
                  <p style={{ fontSize: 12, color: tokens.colors.warning, margin: '4px 0 0' }}>
                    Reminders sent: {contract.reminder_count || 0} / 3
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Document */}
          {contract.document_url && (
            <Card title="Document">
              <Button
                variant="secondary"
                onClick={() => window.open(contract.document_url!, '_blank')}
                style={{ width: '100%' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                View / Download Document
              </Button>
            </Card>
          )}

          {/* PDF Signature Position Picker — only in draft */}
          {showPositionPicker && (
            <Card title="Signature & Date Positions">
              <p style={{ fontSize: 13, color: tokens.colors.textSecondary, marginBottom: 16 }}>
                Select a marker type below, then click on the PDF to place it. Drag markers to reposition.
              </p>

              {/* Marker selector toolbar */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {(Object.keys(MARKER_DEFAULTS) as MarkerKey[]).map(key => {
                  const def = MARKER_DEFAULTS[key];
                  const isActive = activeMarker === key;
                  const isPlaced = !!markers[key];
                  return (
                    <div key={key} style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => setActiveMarker(isActive ? null : key)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: tokens.radius.default,
                          border: `1px solid ${isActive ? def.color : tokens.colors.borderSubtle}`,
                          backgroundColor: isActive ? def.color + '22' : 'transparent',
                          color: isActive ? def.color : tokens.colors.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isPlaced ? '\u2713 ' : ''}{def.label}
                      </button>
                      {isPlaced && (
                        <button
                          onClick={() => removeMarker(key)}
                          title={`Remove ${def.label}`}
                          style={{
                            width: 24, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: tokens.radius.sm, border: `1px solid ${tokens.colors.borderSubtle}`,
                            backgroundColor: 'transparent', color: tokens.colors.textFaint, cursor: 'pointer',
                            fontSize: 14,
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Save button */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <Button
                  onClick={handleSavePositions}
                  loading={savingPositions}
                  disabled={Object.keys(markers).length === 0}
                >
                  Save Positions
                </Button>
                {contract.signature_positions && Object.keys(markers).length > 0 && (
                  <span style={{ fontSize: 12, color: tokens.colors.success, alignSelf: 'center' }}>
                    Positions configured
                  </span>
                )}
              </div>

              {/* PDF render area */}
              {pdfLoading && (
                <p style={{ fontSize: 13, color: tokens.colors.textMuted }}>Loading PDF...</p>
              )}
              <div
                ref={pdfContainerRef}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  maxHeight: 700, overflowY: 'auto',
                  border: `1px solid ${tokens.colors.borderSubtle}`,
                  borderRadius: tokens.radius.md,
                  padding: 8,
                  backgroundColor: '#1a1a22',
                }}
              >
                {pdfPages.map((pageCanvas, pageIndex) => (
                  <div
                    key={pageIndex}
                    data-page-container
                    style={{
                      position: 'relative',
                      width: pageCanvas.width,
                      height: pageCanvas.height,
                      cursor: activeMarker ? 'crosshair' : 'default',
                      flexShrink: 0,
                    }}
                    onClick={(e) => handlePdfPageClick(e, pageIndex)}
                  >
                    {/* Rendered PDF page */}
                    <img
                      src={pageCanvas.toDataURL()}
                      width={pageCanvas.width}
                      height={pageCanvas.height}
                      alt={`Page ${pageIndex + 1}`}
                      style={{ display: 'block', pointerEvents: 'none' }}
                      draggable={false}
                    />

                    {/* Page label */}
                    <div style={{
                      position: 'absolute', top: 4, right: 4, fontSize: 10,
                      padding: '2px 6px', borderRadius: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)', color: '#aaa',
                    }}>
                      Page {pageIndex + 1}
                    </div>

                    {/* Marker overlays */}
                    {(Object.entries(markers) as [MarkerKey, MarkerPosition][]).map(([key, pos]) => {
                      if (pos.page !== pageIndex) return null;
                      const def = MARKER_DEFAULTS[key];
                      return (
                        <div
                          key={key}
                          onMouseDown={(e) => handleMarkerMouseDown(e, key)}
                          style={{
                            position: 'absolute',
                            left: pos.x * pdfScale,
                            top: pos.y * pdfScale,
                            width: pos.width * pdfScale,
                            height: pos.height * pdfScale,
                            border: `2px solid ${def.color}`,
                            backgroundColor: def.color + '22',
                            borderRadius: 4,
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            userSelect: 'none',
                          }}
                        >
                          <span style={{
                            fontSize: 10, color: def.color, fontWeight: 600,
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                            pointerEvents: 'none',
                          }}>
                            {def.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {pdfPages.length === 0 && !pdfLoading && (
                  <p style={{ fontSize: 13, color: tokens.colors.textFaint, padding: 24, textAlign: 'center' }}>
                    No PDF loaded
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Revoke Info */}
          {contract.status === 'revoked' && (
            <Card
              title="Revocation Details"
              style={{ border: `1px solid rgba(239, 68, 68, 0.3)` }}
            >
              <InfoField label="Revoked By" value={contract.revoked_by_name || '-'} />
              <InfoField label="Revoked At" value={contract.revoked_at ? new Date(contract.revoked_at).toLocaleString() : '-'} />
              {contract.revoke_reason && (
                <InfoField label="Reason" value={contract.revoke_reason} />
              )}
            </Card>
          )}
        </div>

        {/* Right: Audit Trail */}
        <div>
          <Card title="Audit Trail">
            {contract.audit_log && contract.audit_log.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {contract.audit_log.map((log, index) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < contract.audit_log!.length - 1 ? `1px solid ${tokens.colors.borderSubtle}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        backgroundColor: log.action === 'created' ? tokens.colors.info
                          : log.action.includes('signed') ? tokens.colors.success
                          : log.action === 'revoked' ? tokens.colors.error
                          : tokens.colors.textFaint,
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: tokens.colors.textPrimary }}>
                        {log.action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    </div>
                    {log.user_name && (
                      <p style={{ fontSize: 12, color: tokens.colors.textSecondary, margin: '2px 0 0 14px' }}>
                        {log.user_name}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: tokens.colors.textFaint, margin: '2px 0 0 14px' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    {log.notes && (
                      <p style={{ fontSize: 12, color: tokens.colors.textMuted, margin: '4px 0 0 14px', fontStyle: 'italic' }}>
                        {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: tokens.colors.textMuted }}>No activity yet</p>
            )}
          </Card>
        </div>
      </div>

      {/* Sign Modal */}
      <Modal
        isOpen={showSignModal}
        onClose={() => setShowSignModal(false)}
        title="Sign Contract"
        description="Draw your signature below to sign this contract internally"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSignModal(false)}>Cancel</Button>
            <Button variant="secondary" onClick={clearCanvas}>Clear</Button>
            <Button onClick={handleSign} loading={signing} disabled={signatureEmpty}>
              Confirm Signature
            </Button>
          </>
        }
      >
        <div
          style={{
            border: `2px dashed ${tokens.colors.borderDefault}`,
            borderRadius: tokens.radius.md,
            backgroundColor: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 200, cursor: 'crosshair', touchAction: 'none', display: 'block' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
        </div>
        <p style={{ fontSize: 12, color: tokens.colors.textFaint, marginTop: 8 }}>
          Use your mouse or touchscreen to sign above
        </p>
      </Modal>

      {/* Revoke Modal */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => { setShowRevokeModal(false); setRevokeReason(''); }}
        title="Revoke Contract"
        description="This action cannot be undone. The contract will be permanently revoked."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowRevokeModal(false); setRevokeReason(''); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRevoke} loading={revoking} disabled={!revokeReason.trim()}>
              Confirm Revocation
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for Revocation"
          required
          value={revokeReason}
          onChange={(e) => setRevokeReason(e.target.value)}
          placeholder="Explain why this contract is being revoked..."
          rows={3}
        />
      </Modal>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 14, color: '#ffffff', margin: '2px 0 0', fontWeight: 500 }}>{value}</p>
    </div>
  );
}
