'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Badge, useToast } from '@/components/erp';
import type { FinAccount } from '@/lib/erp-types';

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

interface AccountNode extends FinAccount {
  children?: AccountNode[];
}

export default function ChartOfAccountsPage() {
  const { toastError, toastSuccess } = useToast();
  const [accounts, setAccounts] = useState<AccountNode[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<FinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    account_type: 'asset',
    normal_balance: 'debit',
    parent_id: '',
    description: '',
  });

  const fetchAccounts = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/finance/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
        setFlatAccounts(data.flat);
        // Expand all top-level accounts by default
        const topLevelIds = new Set<number>(data.accounts.map((a: AccountNode) => a.id));
        setExpandedIds(topLevelIds);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleCreateAccount = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/finance/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newAccount,
          parent_id: newAccount.parent_id ? parseInt(newAccount.parent_id) : null,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewAccount({
          code: '',
          name: '',
          account_type: 'asset',
          normal_balance: 'debit',
          parent_id: '',
          description: '',
        });
        fetchAccounts();
        toastSuccess('Account created');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to create account');
      }
    } catch (error) {
      console.error('Create account error:', error);
      toastError('Failed to create account');
    }

    setCreating(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      asset: '#3B82F6',
      liability: '#EF4444',
      equity: '#8B5CF6',
      revenue: '#10B981',
      expense: '#F59E0B',
    };
    return colors[type] || '#71717a';
  };

  const renderAccountRow = (account: AccountNode, depth: number = 0) => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedIds.has(account.id);

    return (
      <div key={account.id}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '200px 1fr 100px 120px 80px',
            padding: '12px 16px',
            paddingLeft: 16 + depth * 24,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            alignItems: 'center',
            backgroundColor: depth === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(account.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: tokens.colors.textMuted,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : (
              <div style={{ width: 24 }} />
            )}
            <span style={{ fontFamily: 'monospace', color: tokens.colors.textSecondary }}>
              {account.code}
            </span>
          </div>

          <div style={{ fontWeight: depth === 0 ? 600 : 400, color: tokens.colors.textPrimary }}>
            {account.name}
          </div>

          <div>
            <Badge variant="default">
              {account.account_type}
            </Badge>
          </div>

          <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
            <span style={{ color: account.current_balance >= 0 ? tokens.colors.success : tokens.colors.error }}>
              {formatCurrency(account.current_balance || 0)}
            </span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Badge variant={account.is_active ? 'success' : 'default'}>
              {account.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {account.children!.map((child) => renderAccountRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Chart of Accounts
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Manage your general ledger accounts
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Account
        </Button>
      </div>

      {/* Accounts Tree */}
      <Card padding={false}>
        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '200px 1fr 100px 120px 80px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(255,255,255,0.03)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>
            Account #
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>
            Name
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase' }}>
            Type
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', textAlign: 'right' }}>
            Balance
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textMuted, textTransform: 'uppercase', textAlign: 'center' }}>
            Normal
          </div>
        </div>

        {/* Account Rows */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
            Loading accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: tokens.colors.textMuted }}>
            No accounts found. Create your first account to get started.
          </div>
        ) : (
          <div>{accounts.map((account) => renderAccountRow(account))}</div>
        )}
      </Card>

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Account"
        description="Create a new general ledger account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAccount}
              loading={creating}
              disabled={!newAccount.code || !newAccount.name}
            >
              Create Account
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Account Number"
            required
            value={newAccount.code}
            onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
            placeholder="e.g., 1000"
          />

          <Input
            label="Account Name"
            required
            value={newAccount.name}
            onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
            placeholder="e.g., Cash"
          />

          <Select
            label="Account Type"
            required
            value={newAccount.account_type}
            onChange={(e) => {
              const type = e.target.value;
              const normalBalance = ['asset', 'expense'].includes(type) ? 'debit' : 'credit';
              setNewAccount({ ...newAccount, account_type: type, normal_balance: normalBalance });
            }}
            options={[
              { value: 'asset', label: 'Asset' },
              { value: 'liability', label: 'Liability' },
              { value: 'equity', label: 'Equity' },
              { value: 'revenue', label: 'Revenue' },
              { value: 'expense', label: 'Expense' },
            ]}
          />

          <Select
            label="Normal Balance"
            required
            value={newAccount.normal_balance}
            onChange={(e) => setNewAccount({ ...newAccount, normal_balance: e.target.value })}
            options={[
              { value: 'debit', label: 'Debit' },
              { value: 'credit', label: 'Credit' },
            ]}
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Select
              label="Parent Account"
              value={newAccount.parent_id}
              onChange={(e) => setNewAccount({ ...newAccount, parent_id: e.target.value })}
              options={[
                { value: '', label: 'None (Top Level)' },
                ...flatAccounts
                  .filter((a) => a.account_type === newAccount.account_type)
                  .map((a) => ({
                    value: a.id.toString(),
                    label: `${a.code} - ${a.name}`,
                  })),
              ]}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Description"
              value={newAccount.description}
              onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
              placeholder="Optional description..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
