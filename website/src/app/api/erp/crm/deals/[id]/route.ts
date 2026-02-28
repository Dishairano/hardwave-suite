import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMDeal } from '@/lib/erp-types';

// GET /api/erp/crm/deals/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;
    const dealId = parseInt(id);

    const deal = await queryOne<CRMDeal>(`
      SELECT d.*,
        comp.name as company_name,
        c.first_name as contact_first_name, c.last_name as contact_last_name,
        s.name as stage_name, p.name as pipeline_name,
        u.display_name as owner_name
      FROM crm_deals d
      LEFT JOIN crm_companies comp ON d.company_id = comp.id
      LEFT JOIN crm_contacts c ON d.contact_id = c.id
      LEFT JOIN crm_pipeline_stages s ON d.stage_id = s.id
      LEFT JOIN crm_pipelines p ON s.pipeline_id = p.id
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = ?
    `, [dealId]);

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    // Get activities
    const activities = await query<any[]>(`
      SELECT a.*, u.display_name as user_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.deal_id = ?
      ORDER BY a.activity_date DESC
      LIMIT 20
    `, [dealId]);

    return NextResponse.json({ deal, activities });
  } catch (error: any) {
    console.error('Get deal error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/deals/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const dealId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<CRMDeal>('SELECT * FROM crm_deals WHERE id = ?', [dealId]);
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const allowedFields = [
      'name', 'company_id', 'contact_id', 'stage_id', 'owner_id', 'value',
      'currency', 'probability', 'expected_close_date', 'actual_close_date',
      'won', 'loss_reason', 'notes', 'tags', 'custom_fields'
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

    values.push(dealId);
    await query(`UPDATE crm_deals SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'deal',
      entity_id: dealId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<CRMDeal>('SELECT * FROM crm_deals WHERE id = ?', [dealId]);
    return NextResponse.json({ success: true, deal: updated });
  } catch (error: any) {
    console.error('Update deal error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/deals/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const dealId = parseInt(id);

    const existing = await queryOne<CRMDeal>('SELECT * FROM crm_deals WHERE id = ?', [dealId]);
    if (!existing) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await query('DELETE FROM crm_deals WHERE id = ?', [dealId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'deal',
      entity_id: dealId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete deal error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
