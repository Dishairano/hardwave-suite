import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMCompany } from '@/lib/erp-types';

// GET /api/erp/crm/companies/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;
    const companyId = parseInt(id);

    const company = await queryOne<CRMCompany>(`
      SELECT c.*, u.display_name as owner_name
      FROM crm_companies c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE c.id = ?
    `, [companyId]);

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get contacts
    const contacts = await query<any[]>(
      'SELECT * FROM crm_contacts WHERE company_id = ? ORDER BY is_primary DESC, first_name',
      [companyId]
    );

    // Get deals
    const deals = await query<any[]>(`
      SELECT d.*, s.name as stage_name
      FROM crm_deals d
      LEFT JOIN crm_pipeline_stages s ON d.stage_id = s.id
      WHERE d.company_id = ?
      ORDER BY d.created_at DESC
    `, [companyId]);

    return NextResponse.json({ company, contacts, deals });
  } catch (error: any) {
    console.error('Get company error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/companies/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const companyId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<CRMCompany>('SELECT * FROM crm_companies WHERE id = ?', [companyId]);
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'industry', 'website', 'phone', 'email', 'address_line1', 'address_line2',
      'city', 'state', 'postal_code', 'country', 'owner_id', 'notes', 'annual_revenue',
      'employee_count', 'tags', 'custom_fields'
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        if (field === 'tags' || field === 'custom_fields') {
          values.push(JSON.stringify(body[field]));
        } else {
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(companyId);
    await query(`UPDATE crm_companies SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'company',
      entity_id: companyId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<CRMCompany>('SELECT * FROM crm_companies WHERE id = ?', [companyId]);
    return NextResponse.json({ success: true, company: updated });
  } catch (error: any) {
    console.error('Update company error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/companies/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const companyId = parseInt(id);

    const existing = await queryOne<CRMCompany>('SELECT * FROM crm_companies WHERE id = ?', [companyId]);
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Check for active deals
    const activeDeals = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM crm_deals
      WHERE company_id = ? AND actual_close_date IS NULL
    `, [companyId]);
    if (activeDeals && activeDeals.count > 0) {
      return NextResponse.json({ error: 'Cannot delete company with active deals' }, { status: 400 });
    }

    await query('DELETE FROM crm_companies WHERE id = ?', [companyId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'company',
      entity_id: companyId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete company error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
