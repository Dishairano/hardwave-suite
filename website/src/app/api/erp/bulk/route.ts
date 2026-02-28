import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, bulkDelete, bulkUpdate, parseArrayParam } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

type EntityConfig = {
  table: string;
  module: 'finance' | 'projects' | 'hr' | 'crm' | 'inventory' | 'invoicing' | 'settings';
  entityType: string;
  allowedUpdateFields: string[];
  validateDelete?: (id: number) => Promise<string | null>;
};

const entityConfigs: Record<string, EntityConfig> = {
  companies: {
    table: 'crm_companies',
    module: 'crm',
    entityType: 'company',
    allowedUpdateFields: ['industry', 'owner_id', 'tags'],
    validateDelete: async (id) => {
      const deals = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM crm_deals WHERE company_id = ? AND actual_close_date IS NULL', [id]);
      return deals && deals.count > 0 ? 'Has active deals' : null;
    },
  },
  contacts: {
    table: 'crm_contacts',
    module: 'crm',
    entityType: 'contact',
    allowedUpdateFields: ['lead_status', 'owner_id', 'company_id', 'tags'],
  },
  deals: {
    table: 'crm_deals',
    module: 'crm',
    entityType: 'deal',
    allowedUpdateFields: ['stage_id', 'owner_id', 'probability', 'tags'],
  },
  products: {
    table: 'inv_products',
    module: 'inventory',
    entityType: 'product',
    allowedUpdateFields: ['category_id', 'is_active', 'reorder_point'],
    validateDelete: async (id) => {
      const stock = await queryOne<{ total: number }>('SELECT COALESCE(SUM(quantity), 0) as total FROM inv_stock WHERE product_id = ?', [id]);
      return stock && stock.total > 0 ? 'Has stock on hand' : null;
    },
  },
  suppliers: {
    table: 'inv_suppliers',
    module: 'inventory',
    entityType: 'supplier',
    allowedUpdateFields: ['is_active', 'payment_terms'],
    validateDelete: async (id) => {
      const products = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM inv_products WHERE default_supplier_id = ?', [id]);
      return products && products.count > 0 ? 'Has linked products' : null;
    },
  },
  employees: {
    table: 'hr_employees',
    module: 'hr',
    entityType: 'employee',
    allowedUpdateFields: ['department_id', 'position_id', 'manager_id', 'status'],
    validateDelete: async (id) => {
      const pending = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_leave_requests WHERE employee_id = ? AND status = "pending"', [id]);
      return pending && pending.count > 0 ? 'Has pending leave requests' : null;
    },
  },
  departments: {
    table: 'hr_departments',
    module: 'hr',
    entityType: 'department',
    allowedUpdateFields: ['manager_id', 'is_active'],
    validateDelete: async (id) => {
      const employees = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hr_employees WHERE department_id = ? AND status = "active"', [id]);
      return employees && employees.count > 0 ? 'Has active employees' : null;
    },
  },
  expenses: {
    table: 'fin_expenses',
    module: 'finance',
    entityType: 'expense',
    allowedUpdateFields: ['category_id', 'status'],
    validateDelete: async (id) => {
      const expense = await queryOne<{ status: string }>('SELECT status FROM fin_expenses WHERE id = ?', [id]);
      return expense && expense.status === 'approved' ? 'Already approved' : null;
    },
  },
  invoices: {
    table: 'inv_invoices',
    module: 'invoicing',
    entityType: 'invoice',
    allowedUpdateFields: ['status', 'due_date'],
    validateDelete: async (id) => {
      const invoice = await queryOne<{ status: string }>('SELECT status FROM inv_invoices WHERE id = ?', [id]);
      return invoice && invoice.status !== 'draft' ? 'Not a draft invoice' : null;
    },
  },
  projects: {
    table: 'prj_projects',
    module: 'projects',
    entityType: 'project',
    allowedUpdateFields: ['status', 'priority', 'manager_id'],
    validateDelete: async (id) => {
      const unbilled = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM prj_time_entries WHERE project_id = ? AND billable = TRUE AND billed = FALSE', [id]);
      return unbilled && unbilled.count > 0 ? 'Has unbilled time entries' : null;
    },
  },
  tasks: {
    table: 'prj_tasks',
    module: 'projects',
    entityType: 'task',
    allowedUpdateFields: ['status', 'priority', 'assignee_id', 'milestone_id'],
  },
  accounts: {
    table: 'fin_accounts',
    module: 'finance',
    entityType: 'account',
    allowedUpdateFields: ['is_active', 'description'],
    validateDelete: async (id) => {
      const entries = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM fin_journal_lines WHERE account_id = ?', [id]);
      return entries && entries.count > 0 ? 'Has journal entries' : null;
    },
  },
};

// POST /api/erp/bulk - Bulk operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, operation, ids, updates } = body;

    if (!entity || !operation || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'entity, operation, and ids array are required' },
        { status: 400 }
      );
    }

    const config = entityConfigs[entity];
    if (!config) {
      return NextResponse.json(
        { error: `Unknown entity: ${entity}. Supported: ${Object.keys(entityConfigs).join(', ')}` },
        { status: 400 }
      );
    }

    const permission = operation === 'delete' ? 'delete' : 'write';
    const auth = await requireERPPermission(request, config.module, permission);

    let result;

    switch (operation) {
      case 'delete':
        result = await bulkDelete(config.table, ids, config.validateDelete);
        break;

      case 'update':
        if (!updates || Object.keys(updates).length === 0) {
          return NextResponse.json({ error: 'updates object is required for update operation' }, { status: 400 });
        }
        result = await bulkUpdate(config.table, ids, updates, config.allowedUpdateFields);
        break;

      case 'export':
        const records = await query<any[]>(`SELECT * FROM ${config.table} WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        return NextResponse.json({ success: true, data: records, count: records.length });

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}. Supported: delete, update, export` }, { status: 400 });
    }

    // Log the bulk action
    await logERPAction({
      user_id: auth.userId,
      module: config.module,
      action: `bulk_${operation}`,
      entity_type: config.entityType,
      new_values: {
        ids,
        operation,
        updates: operation === 'update' ? updates : undefined,
        result,
      },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Bulk operation error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/erp/bulk/count - Get counts for multiple entities
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);
    const entities = searchParams.get('entities')?.split(',') || Object.keys(entityConfigs);

    const counts: Record<string, number> = {};

    for (const entity of entities) {
      const config = entityConfigs[entity];
      if (config) {
        const result = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${config.table}`);
        counts[entity] = result?.count || 0;
      }
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error('Get counts error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
