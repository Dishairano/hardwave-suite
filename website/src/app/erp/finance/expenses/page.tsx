'use client';

import { useEffect, useState } from 'react';
import { Card, Button, Modal, Input, Select, Textarea, DataTable, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { Column } from '@/components/erp/DataTable';
import type { FinExpense } from '@/lib/erp-types';

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

interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
  expense_count?: number;
  total_amount?: number;
  is_active?: number;
}

const emptyCategory = { name: '', description: '' };

export default function ExpensesPage() {
  const { toastError, toastSuccess } = useToast();
  const [expenses, setExpenses] = useState<FinExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Category management state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);

  const [newExpense, setNewExpense] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    amount: '',
    currency: 'USD',
    description: '',
    vendor: '',
    notes: '',
  });

  const fetchExpenses = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      let url = `/api/erp/finance/expenses?page=${page}&limit=20`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setExpenses(data.items);
        setTotalPages(data.pagination.totalPages);
        setTotalAmount(data.summary?.totalAmount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    }

    setLoading(false);
  };

  const fetchCategories = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/finance/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [page, statusFilter]);

  const handleCreateExpense = async () => {
    setCreating(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('/api/erp/finance/expenses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newExpense,
          category_id: parseInt(newExpense.category_id),
          amount: parseFloat(newExpense.amount),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewExpense({
          expense_date: new Date().toISOString().split('T')[0],
          category_id: '',
          amount: '',
          currency: 'USD',
          description: '',
          vendor: '',
          notes: '',
        });
        fetchExpenses();
        toastSuccess('Expense submitted');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to submit expense');
      }
    } catch (error) {
      console.error('Submit expense error:', error);
      toastError('Failed to submit expense');
    }

    setCreating(false);
  };

  const handleApprove = async (expenseId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/finance/expenses/${expenseId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchExpenses();
        toastSuccess('Expense approved');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to approve expense');
      }
    } catch (error) {
      console.error('Approve expense error:', error);
    }
  };

  const handleReject = async (expenseId: number) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/finance/expenses/${expenseId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        fetchExpenses();
        toastSuccess('Expense rejected');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to reject expense');
      }
    } catch (error) {
      console.error('Reject expense error:', error);
    }
  };

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toastError('Category name is required');
      return;
    }
    setSavingCategory(true);
    const token = localStorage.getItem('token');

    try {
      const isEdit = !!editingCategory;
      const url = isEdit
        ? `/api/erp/finance/categories/${editingCategory!.id}`
        : '/api/erp/finance/categories';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryForm),
      });

      if (res.ok) {
        toastSuccess(isEdit ? 'Category updated' : 'Category created');
        setShowCategoryForm(false);
        setEditingCategory(null);
        setCategoryForm(emptyCategory);
        fetchCategories();
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('Save category error:', error);
      toastError('Failed to save category');
    }

    setSavingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/finance/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toastSuccess('Category deleted');
        setDeletingCategory(null);
        fetchCategories();
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Delete category error:', error);
      toastError('Failed to delete category');
    }
  };

  const openEditCategory = (cat: ExpenseCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, description: cat.description || '' });
    setShowCategoryForm(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategory);
    setShowCategoryForm(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const columns: Column<FinExpense>[] = [
    {
      key: 'expense_number',
      header: 'Expense #',
      width: 120,
      render: (value) => (
        <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink }}>{value}</span>
      ),
    },
    {
      key: 'expense_date',
      header: 'Date',
      width: 100,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'category_name',
      header: 'Category',
      width: 150,
      render: (value) => (
        <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (_, row) => (
        <div>
          <div style={{ color: tokens.colors.textPrimary }}>
            {row.description || row.vendor || '-'}
          </div>
          {row.vendor && row.description && (
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.vendor}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: 120,
      render: (value) => (
        <span style={{ fontWeight: 600, color: tokens.colors.warning, fontFamily: 'monospace' }}>
          {formatCurrency(value || 0)}
        </span>
      ),
    },
    {
      key: 'submitted_by_name',
      header: 'Submitted By',
      width: 120,
      render: (value) => <span style={{ color: tokens.colors.textSecondary }}>{value || '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (value) => {
        const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
          pending: 'warning',
          approved: 'success',
          rejected: 'error',
          paid: 'success',
        };
        return <Badge variant={statusColors[value] || 'default'}>{value}</Badge>;
      },
    },
    {
      key: 'id',
      header: '',
      width: 140,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {row.status === 'submitted' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApprove(row.id)}
                style={{ color: tokens.colors.success }}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReject(row.id)}
                style={{ color: tokens.colors.error }}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
            Expenses
          </h1>
          <p style={{ fontSize: 14, color: tokens.colors.textMuted, margin: '4px 0 0' }}>
            Submit and approve expense reimbursements
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => setShowCategoryModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            Categories
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Submit Expense
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginBottom: 24,
          padding: 16,
          backgroundColor: '#101018',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 4 }}>Total (filtered)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.warning }}>
            {formatCurrency(totalAmount)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div className="erp-filter-bar" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: 200 }}>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'submitted', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card padding={false}>
        <DataTable
          columns={columns}
          data={expenses}
          loading={loading}
          rowKey={(row) => row.id}
          emptyMessage="No expenses found"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span style={{ padding: '8px 12px', color: tokens.colors.textSecondary }}>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Submit Expense Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Submit Expense"
        description="Submit an expense for reimbursement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateExpense}
              loading={creating}
              disabled={!newExpense.category_id || !newExpense.amount}
            >
              Submit Expense
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Expense Date"
            type="date"
            required
            value={newExpense.expense_date}
            onChange={(e) => setNewExpense({ ...newExpense, expense_date: e.target.value })}
          />

          <Select
            label="Category"
            required
            value={newExpense.category_id}
            onChange={(e) => setNewExpense({ ...newExpense, category_id: e.target.value })}
            options={[
              { value: '', label: 'Select category...' },
              ...categories.map(c => ({ value: c.id.toString(), label: c.name })),
            ]}
          />

          <Input
            label="Amount"
            type="number"
            required
            value={newExpense.amount}
            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
            placeholder="0.00"
            leftIcon={<span>$</span>}
          />

          <Input
            label="Vendor / Merchant"
            value={newExpense.vendor}
            onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })}
            placeholder="e.g., Amazon, Uber, etc."
          />

          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Description"
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              placeholder="What was this expense for?"
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Notes"
              value={newExpense.notes}
              onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
              placeholder="Additional notes or justification..."
              rows={2}
            />
          </div>
        </div>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setShowCategoryForm(false); setEditingCategory(null); }}
        title="Expense Categories"
        description="Manage the categories available for expense submissions"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div />
            <Button variant="secondary" onClick={() => { setShowCategoryModal(false); setShowCategoryForm(false); }}>
              Close
            </Button>
          </div>
        }
      >
        {showCategoryForm ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <span style={{ color: tokens.colors.textPrimary, fontWeight: 600 }}>
                {editingCategory ? 'Edit Category' : 'New Category'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input
                label="Name"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Travel, Software, Marketing..."
              />
              <Input
                label="Description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button variant="secondary" onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCategory} loading={savingCategory} disabled={!categoryForm.name.trim()}>
                  {editingCategory ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Button size="sm" onClick={openCreateCategory}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Category
              </Button>
            </div>

            {categories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: tokens.colors.textMuted }}>
                No categories yet. Create one to get started.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ color: tokens.colors.textPrimary, fontWeight: 500, fontSize: 14 }}>
                        {cat.name}
                      </div>
                      {cat.description && (
                        <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {cat.description}
                        </div>
                      )}
                    </div>
                    {cat.expense_count !== undefined && (
                      <span style={{
                        color: tokens.colors.textMuted,
                        fontSize: 12,
                        marginRight: 12,
                        whiteSpace: 'nowrap',
                      }}>
                        {cat.expense_count} expense{cat.expense_count !== 1 ? 's' : ''}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingCategory(cat)}
                        style={{ color: tokens.colors.error }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Category Confirm */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteCategory}
        title="Delete Category"
        message={`Are you sure you want to delete "${deletingCategory?.name}"? This cannot be undone. Categories with existing expenses cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
