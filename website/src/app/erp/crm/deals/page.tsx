'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanBoard, KanbanCard, Button, Modal, Input, Select, Textarea, Card, StatCard, StatCardGrid, useToast } from '@/components/erp';
import type { KanbanColumn } from '@/components/erp/KanbanBoard';
import type { CRMDeal, CRMPipelineStage, CRMCompany, CRMContact } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
};

interface Pipeline {
  id: number;
  name: string;
  stages: CRMPipelineStage[];
}

export default function DealsPage() {
  const router = useRouter();
  const { toastError, toastSuccess } = useToast();
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<CRMCompany[]>([]);
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState({ totalValue: 0 });

  const [newDeal, setNewDeal] = useState({
    name: '',
    company_id: '',
    contact_id: '',
    stage_id: '',
    amount: '',
    expected_close_date: '',
    description: '',
  });

  const fetchPipelines = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/pipelines?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];

        // Fetch stages for each pipeline
        const pipelinesWithStages: Pipeline[] = await Promise.all(
          items.map(async (p: any) => {
            const stagesRes = await fetch(`/api/erp/crm/pipeline-stages?pipeline_id=${p.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const stagesData = stagesRes.ok ? await stagesRes.json() : { items: [] };
            return { id: p.id, name: p.name, stages: stagesData.items || [] };
          })
        );

        setPipelines(pipelinesWithStages);
        setSelectedPipelineId(pipelinesWithStages[0]?.id || null);
      }
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    }
  };

  const fetchDeals = useCallback(async () => {
    if (!selectedPipelineId) return;

    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/crm/deals?pipeline_id=${selectedPipelineId}&limit=500`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDeals(data.items);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    }

    setLoading(false);
  }, [selectedPipelineId]);

  const fetchCompanies = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/companies?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchContacts = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/crm/contacts?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  useEffect(() => {
    fetchPipelines();
    fetchCompanies();
    fetchContacts();
  }, []);

  useEffect(() => {
    if (selectedPipelineId) {
      fetchDeals();
    }
  }, [selectedPipelineId, fetchDeals]);

  const handleDragEnd = async (deal: CRMDeal, sourceStage: string, targetStage: string) => {
    if (sourceStage === targetStage) return;

    const token = localStorage.getItem('token');

    // Optimistically update UI
    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id ? { ...d, stage_id: parseInt(targetStage) } : d
      )
    );

    try {
      await fetch(`/api/erp/crm/deals/${deal.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage_id: parseInt(targetStage) }),
      });
    } catch (error) {
      console.error('Failed to update deal stage:', error);
      fetchDeals();
    }
  };

  const handleCreateDeal = async () => {
    if (!selectedPipelineId) return;

    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/crm/deals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newDeal.name,
          company_id: newDeal.company_id ? parseInt(newDeal.company_id) : null,
          contact_id: newDeal.contact_id ? parseInt(newDeal.contact_id) : null,
          pipeline_id: selectedPipelineId,
          stage_id: newDeal.stage_id ? parseInt(newDeal.stage_id) : pipelines.find(p => p.id === selectedPipelineId)?.stages[0]?.id,
          amount: newDeal.amount ? parseFloat(newDeal.amount) : 0,
          expected_close_date: newDeal.expected_close_date || null,
          description: newDeal.description || null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewDeal({
          name: '',
          company_id: '',
          contact_id: '',
          stage_id: '',
          amount: '',
          expected_close_date: '',
          description: '',
        });
        fetchDeals();
        toastSuccess('Deal created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create deal');
      }
    } catch (error) {
      console.error('Create deal error:', error);
      toastError('Failed to create deal');
    }

    setCreating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Build Kanban columns from pipeline stages
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
  const columns: KanbanColumn<CRMDeal>[] = (selectedPipeline?.stages || [])
    .filter(stage => !stage.is_lost) // Exclude lost stage from main board
    .map((stage) => ({
      id: stage.id.toString(),
      title: stage.name,
      color: stage.color,
      items: deals.filter((d) => d.stage_id === stage.id),
    }));

  // Calculate stage totals
  const stageTotals = columns.map((col) => ({
    ...col,
    totalValue: col.items.reduce((sum, deal) => sum + (deal.amount || 0), 0),
  }));

  const renderDealCard = (deal: CRMDeal) => (
    <KanbanCard
      title={deal.name}
      subtitle={deal.company_name || deal.contact_name || deal.deal_number}
      labels={[]}
      dueDate={deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : undefined}
      assignee={deal.owner_name ? { name: deal.owner_name } : undefined}
      onClick={() => router.push(`/erp/crm/deals/${deal.id}`)}
      actions={
        <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.success }}>
          {formatCurrency(deal.amount || 0)}
        </span>
      }
    />
  );

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Deal Pipeline
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your sales pipeline and track deal progress
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={selectedPipelineId || ''}
            onChange={(e) => setSelectedPipelineId(parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              backgroundColor: '#101018',
              color: '#a1a1aa',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Deal
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
        {stageTotals.map((stage) => (
          <div
            key={stage.id}
            style={{
              minWidth: 150,
              padding: '12px 16px',
              backgroundColor: '#101018',
              borderRadius: 8,
              border: `1px solid ${stage.color}30`,
              borderTop: `3px solid ${stage.color}`,
            }}
          >
            <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>
              {stage.title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.textPrimary }}>
                {stage.items.length}
              </span>
              <span style={{ fontSize: 13, color: tokens.colors.success }}>
                {formatCurrency(stage.totalValue)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Board */}
      {selectedPipelineId ? (
        <KanbanBoard
          columns={columns}
          onDragEnd={handleDragEnd}
          renderCard={renderDealCard}
          itemKey={(deal) => deal.id}
          onAddItem={() => setShowCreateModal(true)}
          loading={loading}
          columnWidth={280}
        />
      ) : (
        <Card>
          <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
            Select a pipeline to view deals
          </div>
        </Card>
      )}

      {/* Create Deal Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Deal"
        description="Add a new deal to your pipeline"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDeal} loading={creating} disabled={!newDeal.name}>
              Create Deal
            </Button>
          </>
        }
      >
        <Input
          label="Deal Name"
          required
          value={newDeal.name}
          onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
          placeholder="e.g., Enterprise License - Acme Corp"
        />

        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Company"
            value={newDeal.company_id}
            onChange={(e) => setNewDeal({ ...newDeal, company_id: e.target.value })}
            options={[
              { value: '', label: 'Select company...' },
              ...companies.map((c) => ({ value: c.id.toString(), label: c.name })),
            ]}
          />

          <Select
            label="Contact"
            value={newDeal.contact_id}
            onChange={(e) => setNewDeal({ ...newDeal, contact_id: e.target.value })}
            options={[
              { value: '', label: 'Select contact...' },
              ...contacts.map((c) => ({
                value: c.id.toString(),
                label: `${c.first_name} ${c.last_name || ''}`.trim(),
              })),
            ]}
          />

          <Input
            label="Deal Value"
            type="number"
            value={newDeal.amount}
            onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
            placeholder="0.00"
            leftIcon={<span>$</span>}
          />

          <Input
            label="Expected Close Date"
            type="date"
            value={newDeal.expected_close_date}
            onChange={(e) => setNewDeal({ ...newDeal, expected_close_date: e.target.value })}
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Starting Stage"
              value={newDeal.stage_id}
              onChange={(e) => setNewDeal({ ...newDeal, stage_id: e.target.value })}
              options={[
                { value: '', label: 'Select stage...' },
                ...(selectedPipeline?.stages.filter(s => !s.is_won && !s.is_lost) || []).map((s) => ({
                  value: s.id.toString(),
                  label: s.name,
                })),
              ]}
            />
          </div>
        </div>

        <Textarea
          label="Description"
          value={newDeal.description}
          onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
          placeholder="Deal notes..."
        />
      </Modal>
    </div>
  );
}
