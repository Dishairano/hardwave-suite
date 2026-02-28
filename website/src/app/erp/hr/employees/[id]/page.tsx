'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, Button, Modal, Input, Select, Badge, useToast, ConfirmDialog } from '@/components/erp';
import type { HREmployee, HREmployeeDocument, HRDepartment, HRPosition, HRLeaveBalance, HRDocumentTemplate } from '@/lib/erp-types';

const tokens = {
  colors: {
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    brandPink: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    border: '#27272a',
    cardBg: '#18181b',
  },
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const { toastError, toastSuccess } = useToast();

  const [employee, setEmployee] = useState<HREmployee | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<HRLeaveBalance[]>([]);
  const [documents, setDocuments] = useState<HREmployeeDocument[]>([]);
  const [departments, setDepartments] = useState<HRDepartment[]>([]);
  const [positions, setPositions] = useState<HRPosition[]>([]);
  const [employees, setEmployees] = useState<HREmployee[]>([]);
  const [templates, setTemplates] = useState<HRDocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingSection, setEditingSection] = useState<'personal' | 'employment' | 'compensation' | 'emergency' | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<HREmployee>>({});

  const [showDocModal, setShowDocModal] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    document_type: 'contract',
    title: '',
    description: '',
    document_url: '',
    issue_date: '',
    expiry_date: '',
    status: 'active',
  });

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'employee' | 'document'; id: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployee = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/hr/employees/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEmployee(data.employee);
        setLeaveBalances(data.leaveBalances || []);
      } else {
        toastError('Failed to load employee');
        router.push('/erp/hr/employees');
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      toastError('Failed to load employee');
    }
    setLoading(false);
  };

  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/erp/hr/employees/${employeeId}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const fetchDepartments = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/departments?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const fetchPositions = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/positions?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPositions(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchEmployees = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/employees?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.items.filter((e: HREmployee) => e.id.toString() !== employeeId));
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const fetchTemplates = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/erp/hr/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates.filter((t: HRDocumentTemplate) => t.is_active));
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  useEffect(() => {
    fetchEmployee();
    fetchDocuments();
    fetchDepartments();
    fetchPositions();
    fetchEmployees();
    fetchTemplates();
  }, [employeeId]);

  const handleEditSection = (section: 'personal' | 'employment' | 'compensation' | 'emergency') => {
    if (!employee) return;

    // Pre-fill form with current values based on section
    if (section === 'personal') {
      setEditForm({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        phone: employee.phone || '',
        personal_email: employee.personal_email || '',
        date_of_birth: employee.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : '',
        gender: employee.gender || '',
        address_line1: employee.address_line1 || '',
        address_line2: employee.address_line2 || '',
        city: employee.city || '',
        state: employee.state || '',
        postal_code: employee.postal_code || '',
        country: employee.country || 'USA',
      });
    } else if (section === 'employment') {
      setEditForm({
        department_id: employee.department_id,
        position_id: employee.position_id,
        manager_id: employee.manager_id,
        employment_type: employee.employment_type,
        employment_status: employee.employment_status,
        hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : '',
        termination_date: employee.termination_date ? new Date(employee.termination_date).toISOString().split('T')[0] : '',
        probation_end_date: employee.probation_end_date ? new Date(employee.probation_end_date).toISOString().split('T')[0] : '',
        work_location: employee.work_location,
      });
    } else if (section === 'compensation') {
      setEditForm({
        salary: employee.salary,
        salary_frequency: employee.salary_frequency,
        currency: employee.currency || 'USD',
        bank_name: employee.bank_name || '',
        bank_account_number: employee.bank_account_number || '',
        bank_routing_number: employee.bank_routing_number || '',
        tax_id: employee.tax_id || '',
      });
    } else if (section === 'emergency') {
      setEditForm({
        emergency_contact_name: employee.emergency_contact_name || '',
        emergency_contact_phone: employee.emergency_contact_phone || '',
        emergency_contact_relation: employee.emergency_contact_relation || '',
      });
    }

    setEditingSection(section);
  };

  const handleSaveEdit = async () => {
    setEditing(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/employees/${employeeId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        setEditingSection(null);
        setEditForm({});
        fetchEmployee();
        toastSuccess('Employee updated');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Update employee error:', error);
      toastError('Failed to update employee');
    }

    setEditing(false);
  };

  const handleCloseEditModal = () => {
    setEditingSection(null);
    setEditForm({});
  };

  const handleTemplateSelect = (templateId: string) => {
    if (!templateId || !employee) return;

    const template = templates.find((t) => t.id.toString() === templateId);
    if (!template) return;

    // Replace placeholders in title and description
    const replacements: Record<string, string> = {
      '{employee_name}': `${employee.first_name} ${employee.last_name}`,
      '{date}': new Date().toLocaleDateString(),
      '{position}': employee.position_title || '',
      '{department}': employee.department_name || '',
      '{employee_number}': employee.employee_number,
    };

    let title = template.title_template;
    let description = template.description_template || '';

    Object.entries(replacements).forEach(([placeholder, value]) => {
      title = title.replace(new RegExp(placeholder, 'g'), value);
      description = description.replace(new RegExp(placeholder, 'g'), value);
    });

    setDocForm({
      ...docForm,
      document_type: template.document_type,
      title,
      description,
    });
  };

  const handleCreateDocument = async () => {
    setCreatingDoc(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`/api/erp/hr/employees/${employeeId}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(docForm),
      });

      if (res.ok) {
        setShowDocModal(false);
        setDocForm({
          document_type: 'contract',
          title: '',
          description: '',
          document_url: '',
          issue_date: '',
          expiry_date: '',
          status: 'active',
        });
        fetchDocuments();
        toastSuccess('Document added');
      } else {
        const error = await res.json();
        toastError(error.error || 'Failed to add document');
      }
    } catch (error) {
      console.error('Create document error:', error);
      toastError('Failed to add document');
    }

    setCreatingDoc(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = localStorage.getItem('token');

    try {
      if (deleteTarget.type === 'employee') {
        const res = await fetch(`/api/erp/hr/employees/${employeeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          toastSuccess('Employee deleted');
          router.push('/erp/hr/employees');
        } else {
          const error = await res.json();
          toastError(error.error || 'Failed to delete employee');
        }
      } else if (deleteTarget.type === 'document') {
        const res = await fetch(`/api/erp/hr/employees/${employeeId}/documents/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          setDeleteTarget(null);
          fetchDocuments();
          toastSuccess('Document deleted');
        } else {
          const error = await res.json();
          toastError(error.error || 'Failed to delete document');
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      toastError('Failed to delete');
    }

    setDeleting(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: employee?.currency || 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | null | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const redactBankAccount = (account: string | null) => {
    if (!account) return '-';
    if (account.length <= 4) return account;
    return `****${account.slice(-4)}`;
  };

  const redactTaxId = (taxId: string | null) => {
    if (!taxId) return '-';
    if (taxId.length <= 4) return taxId;
    return `****${taxId.slice(-4)}`;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <p style={{ color: tokens.colors.textMuted }}>Loading...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        <p style={{ color: tokens.colors.textMuted }}>Employee not found</p>
      </div>
    );
  }

  const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    active: 'success',
    on_leave: 'warning',
    terminated: 'error',
    suspended: 'error',
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/erp/hr/employees')}
          style={{ marginBottom: 16 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Employees
        </Button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.textPrimary, margin: 0 }}>
              {employee.first_name} {employee.last_name}
            </h1>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', color: tokens.colors.brandPink, fontSize: 14 }}>
                {employee.employee_number}
              </span>
              <Badge variant={statusColors[employee.employment_status] || 'default'}>
                {employee.employment_status}
              </Badge>
              {employee.department_name && (
                <Badge variant="default">{employee.department_name}</Badge>
              )}
            </div>
          </div>

          <Button
            variant="danger"
            onClick={() => setDeleteTarget({ type: 'employee', id: employee.id })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="erp-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Personal Information */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                Personal Information
              </h3>
              <Button size="sm" variant="ghost" onClick={() => handleEditSection('personal')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </Button>
            </div>
            <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Name: </span>
                <span style={{ color: tokens.colors.textPrimary }}>
                  {employee.first_name} {employee.last_name}
                </span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Email: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.email}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Phone: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.phone || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Personal Email: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.personal_email || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Date of Birth: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{formatDate(employee.date_of_birth)}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Gender: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.gender || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Address: </span>
                <span style={{ color: tokens.colors.textPrimary }}>
                  {employee.address_line1 || '-'}
                  {employee.address_line2 && `, ${employee.address_line2}`}
                  {employee.city && `, ${employee.city}`}
                  {employee.state && `, ${employee.state}`}
                  {employee.postal_code && ` ${employee.postal_code}`}
                  {employee.country && `, ${employee.country}`}
                </span>
              </div>
            </div>
          </Card>

          {/* Compensation */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                Compensation
              </h3>
              <Button size="sm" variant="ghost" onClick={() => handleEditSection('compensation')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </Button>
            </div>
            <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Salary: </span>
                <span style={{ color: tokens.colors.textPrimary, fontWeight: 600 }}>
                  {formatCurrency(employee.salary)}
                </span>
                <span style={{ color: tokens.colors.textMuted, marginLeft: 4 }}>
                  ({employee.salary_frequency})
                </span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Currency: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.currency}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Bank Name: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.bank_name || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Account Number: </span>
                <span style={{ color: tokens.colors.textPrimary, fontFamily: 'monospace' }}>
                  {redactBankAccount(employee.bank_account_number)}
                </span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Tax ID: </span>
                <span style={{ color: tokens.colors.textPrimary, fontFamily: 'monospace' }}>
                  {redactTaxId(employee.tax_id)}
                </span>
              </div>
            </div>
          </Card>

          {/* Leave Balances */}
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
              Leave Balances
            </h3>
            {leaveBalances.length > 0 ? (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
                      <th style={{ padding: '8px 0', textAlign: 'left', color: tokens.colors.textMuted, fontWeight: 500 }}>
                        Type
                      </th>
                      <th style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textMuted, fontWeight: 500 }}>
                        Entitled
                      </th>
                      <th style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textMuted, fontWeight: 500 }}>
                        Used
                      </th>
                      <th style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textMuted, fontWeight: 500 }}>
                        Remaining
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveBalances.map((lb) => (
                      <tr key={lb.id} style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
                        <td style={{ padding: '8px 0', color: tokens.colors.textPrimary }}>{lb.leave_type_name}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textSecondary }}>
                          {lb.entitled_days}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textSecondary }}>
                          {lb.used_days}
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', color: tokens.colors.textPrimary, fontWeight: 600 }}>
                          {lb.remaining_days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No leave balances configured</p>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Employment Details */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                Employment Details
              </h3>
              <Button size="sm" variant="ghost" onClick={() => handleEditSection('employment')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </Button>
            </div>
            <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Employee Number: </span>
                <span style={{ color: tokens.colors.brandPink, fontFamily: 'monospace' }}>
                  {employee.employee_number}
                </span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Department: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.department_name || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Position: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.position_title || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Manager: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.manager_name || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Employment Type: </span>
                <span style={{ color: tokens.colors.textPrimary }}>
                  {employee.employment_type.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Status: </span>
                <Badge variant={statusColors[employee.employment_status] || 'default'}>
                  {employee.employment_status}
                </Badge>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Hire Date: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{formatDate(employee.hire_date)}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Work Location: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.work_location}</span>
              </div>
              {employee.probation_end_date && (
                <div>
                  <span style={{ color: tokens.colors.textMuted }}>Probation End: </span>
                  <span style={{ color: tokens.colors.textPrimary }}>{formatDate(employee.probation_end_date)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
                Emergency Contact
              </h3>
              <Button size="sm" variant="ghost" onClick={() => handleEditSection('emergency')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </Button>
            </div>
            <div style={{ display: 'grid', gap: 12, fontSize: 14 }}>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Name: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.emergency_contact_name || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Phone: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.emergency_contact_phone || '-'}</span>
              </div>
              <div>
                <span style={{ color: tokens.colors.textMuted }}>Relation: </span>
                <span style={{ color: tokens.colors.textPrimary }}>{employee.emergency_contact_relation || '-'}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {employee.notes && (
            <Card>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: '0 0 16px' }}>
                Notes
              </h3>
              <p style={{ fontSize: 14, color: tokens.colors.textSecondary, whiteSpace: 'pre-wrap', margin: 0 }}>
                {employee.notes}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Documents & Contracts - Full Width */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: tokens.colors.textPrimary, margin: 0 }}>
            Documents & Contracts
          </h3>
          <Button size="sm" onClick={() => setShowDocModal(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Document
          </Button>
        </div>

        {documents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  padding: 16,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Badge variant="default">{doc.document_type.replace('_', ' ')}</Badge>
                    <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.textPrimary }}>
                      {doc.title}
                    </span>
                  </div>
                  {doc.description && (
                    <p style={{ fontSize: 13, color: tokens.colors.textSecondary, margin: '4px 0' }}>
                      {doc.description}
                    </p>
                  )}
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 8 }}>
                    {doc.issue_date && <span>Issued: {formatDate(doc.issue_date)} </span>}
                    {doc.expiry_date && <span>• Expires: {formatDate(doc.expiry_date)} </span>}
                    {doc.uploaded_by_name && <span>• Uploaded by: {doc.uploaded_by_name}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {doc.document_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(doc.document_url!, '_blank')}
                      title="Open Document"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget({ type: 'document', id: doc.id })}
                    title="Delete"
                    style={{ color: tokens.colors.error }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: tokens.colors.textMuted, fontSize: 14, textAlign: 'center', padding: 24 }}>
            No documents added yet
          </p>
        )}
      </Card>

      {/* Edit Personal Information Modal */}
      <Modal
        isOpen={editingSection === 'personal'}
        onClose={handleCloseEditModal}
        title="Edit Personal Information"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={editing}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="First Name"
            required
            value={editForm.first_name || ''}
            onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
          />
          <Input
            label="Last Name"
            required
            value={editForm.last_name || ''}
            onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={editForm.email || ''}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Phone"
            value={editForm.phone || ''}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Input
            label="Personal Email"
            type="email"
            value={editForm.personal_email || ''}
            onChange={(e) => setEditForm({ ...editForm, personal_email: e.target.value })}
          />
          <Input
            label="Date of Birth"
            type="date"
            value={editForm.date_of_birth || ''}
            onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
          />
          <Select
            label="Gender"
            value={editForm.gender || ''}
            onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as any })}
            options={[
              { value: '', label: 'Select gender...' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
              { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            ]}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Address Line 1"
              value={editForm.address_line1 || ''}
              onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Address Line 2"
              value={editForm.address_line2 || ''}
              onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
            />
          </div>
          <Input
            label="City"
            value={editForm.city || ''}
            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
          />
          <Input
            label="State"
            value={editForm.state || ''}
            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
          />
          <Input
            label="Postal Code"
            value={editForm.postal_code || ''}
            onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
          />
          <Input
            label="Country"
            value={editForm.country || ''}
            onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
          />
        </div>
      </Modal>

      {/* Edit Employment Details Modal */}
      <Modal
        isOpen={editingSection === 'employment'}
        onClose={handleCloseEditModal}
        title="Edit Employment Details"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={editing}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Select
            label="Department"
            value={editForm.department_id?.toString() || ''}
            onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value ? parseInt(e.target.value) : null })}
            options={[
              { value: '', label: 'Select department...' },
              ...departments.map((d) => ({ value: d.id.toString(), label: d.name })),
            ]}
          />
          <Select
            label="Position"
            value={editForm.position_id?.toString() || ''}
            onChange={(e) => setEditForm({ ...editForm, position_id: e.target.value ? parseInt(e.target.value) : null })}
            options={[
              { value: '', label: 'Select position...' },
              ...positions.map((p) => ({ value: p.id.toString(), label: p.title })),
            ]}
          />
          <Select
            label="Manager"
            value={editForm.manager_id?.toString() || ''}
            onChange={(e) => setEditForm({ ...editForm, manager_id: e.target.value ? parseInt(e.target.value) : null })}
            options={[
              { value: '', label: 'No manager' },
              ...employees.map((e) => ({ value: e.id.toString(), label: `${e.first_name} ${e.last_name}` })),
            ]}
          />
          <Select
            label="Employment Type"
            value={editForm.employment_type || ''}
            onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value as any })}
            options={[
              { value: 'full_time', label: 'Full-time' },
              { value: 'part_time', label: 'Part-time' },
              { value: 'contract', label: 'Contract' },
              { value: 'intern', label: 'Intern' },
            ]}
          />
          <Select
            label="Employment Status"
            value={editForm.employment_status || ''}
            onChange={(e) => setEditForm({ ...editForm, employment_status: e.target.value as any })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'on_leave', label: 'On Leave' },
              { value: 'terminated', label: 'Terminated' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <Select
            label="Work Location"
            value={editForm.work_location || ''}
            onChange={(e) => setEditForm({ ...editForm, work_location: e.target.value as any })}
            options={[
              { value: 'office', label: 'Office' },
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
          />
          <Input
            label="Hire Date"
            type="date"
            value={editForm.hire_date || ''}
            onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
          />
          <Input
            label="Termination Date"
            type="date"
            value={editForm.termination_date || ''}
            onChange={(e) => setEditForm({ ...editForm, termination_date: e.target.value })}
          />
          <Input
            label="Probation End Date"
            type="date"
            value={editForm.probation_end_date || ''}
            onChange={(e) => setEditForm({ ...editForm, probation_end_date: e.target.value })}
          />
        </div>
      </Modal>

      {/* Edit Compensation Modal */}
      <Modal
        isOpen={editingSection === 'compensation'}
        onClose={handleCloseEditModal}
        title="Edit Compensation"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={editing}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Salary"
            type="number"
            value={editForm.salary?.toString() || ''}
            onChange={(e) => setEditForm({ ...editForm, salary: e.target.value ? parseFloat(e.target.value) : null })}
          />
          <Select
            label="Salary Frequency"
            value={editForm.salary_frequency || ''}
            onChange={(e) => setEditForm({ ...editForm, salary_frequency: e.target.value as any })}
            options={[
              { value: 'hourly', label: 'Hourly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'annual', label: 'Annual' },
            ]}
          />
          <Input
            label="Currency"
            value={editForm.currency || ''}
            onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
          />
          <Input
            label="Bank Name"
            value={editForm.bank_name || ''}
            onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
          />
          <Input
            label="Bank Account Number"
            value={editForm.bank_account_number || ''}
            onChange={(e) => setEditForm({ ...editForm, bank_account_number: e.target.value })}
          />
          <Input
            label="Bank Routing Number"
            value={editForm.bank_routing_number || ''}
            onChange={(e) => setEditForm({ ...editForm, bank_routing_number: e.target.value })}
          />
          <Input
            label="Tax ID"
            value={editForm.tax_id || ''}
            onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
          />
        </div>
      </Modal>

      {/* Edit Emergency Contact Modal */}
      <Modal
        isOpen={editingSection === 'emergency'}
        onClose={handleCloseEditModal}
        title="Edit Emergency Contact"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={editing}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input
            label="Contact Name"
            value={editForm.emergency_contact_name || ''}
            onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })}
          />
          <Input
            label="Contact Phone"
            value={editForm.emergency_contact_phone || ''}
            onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })}
          />
          <Input
            label="Relation"
            value={editForm.emergency_contact_relation || ''}
            onChange={(e) => setEditForm({ ...editForm, emergency_contact_relation: e.target.value })}
          />
        </div>
      </Modal>

      {/* Add Document Modal */}
      <Modal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title="Add Document"
        description="Upload a new document or contract"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDocModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateDocument}
              loading={creatingDoc}
              disabled={!docForm.document_type || !docForm.title}
            >
              Add Document
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {templates.length > 0 && (
            <Select
              label="Use Template (Optional)"
              value=""
              onChange={(e) => handleTemplateSelect(e.target.value)}
              options={[
                { value: '', label: 'Start from scratch...' },
                ...templates.map((t) => ({
                  value: t.id.toString(),
                  label: `${t.name} (${t.document_type.replace('_', ' ')})`,
                })),
              ]}
            />
          )}
          <Select
            label="Document Type"
            required
            value={docForm.document_type}
            onChange={(e) => setDocForm({ ...docForm, document_type: e.target.value })}
            options={[
              { value: 'contract', label: 'Contract' },
              { value: 'nda', label: 'NDA' },
              { value: 'offer_letter', label: 'Offer Letter' },
              { value: 'performance_review', label: 'Performance Review' },
              { value: 'certification', label: 'Certification' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input
            label="Title"
            required
            value={docForm.title}
            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
            placeholder="e.g., Employment Contract 2024"
          />
          <textarea
            value={docForm.description}
            onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
            placeholder="Description (optional)"
            style={{
              width: '100%',
              minHeight: 80,
              padding: 12,
              backgroundColor: tokens.colors.cardBg,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: 6,
              color: tokens.colors.textPrimary,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <Input
            label="Document URL"
            value={docForm.document_url}
            onChange={(e) => setDocForm({ ...docForm, document_url: e.target.value })}
            placeholder="https://..."
          />
          <div className="erp-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input
              label="Issue Date"
              type="date"
              value={docForm.issue_date}
              onChange={(e) => setDocForm({ ...docForm, issue_date: e.target.value })}
            />
            <Input
              label="Expiry Date"
              type="date"
              value={docForm.expiry_date}
              onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
            />
          </div>
          <Select
            label="Status"
            value={docForm.status}
            onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === 'employee' ? 'Delete Employee' : 'Delete Document'}
        description={
          deleteTarget?.type === 'employee'
            ? `Are you sure you want to delete ${employee.first_name} ${employee.last_name}? This action cannot be undone.`
            : 'Are you sure you want to delete this document? This action cannot be undone.'
        }
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
