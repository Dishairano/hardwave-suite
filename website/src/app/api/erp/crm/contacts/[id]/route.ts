import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMContact } from '@/lib/erp-types';

// GET /api/erp/crm/contacts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;
    const contactId = parseInt(id);

    const contact = await queryOne<CRMContact>(`
      SELECT c.*, comp.name as company_name, u.display_name as owner_name
      FROM crm_contacts c
      LEFT JOIN crm_companies comp ON c.company_id = comp.id
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE c.id = ?
    `, [contactId]);

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Get activities
    const activities = await query<any[]>(`
      SELECT a.*, u.display_name as user_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.contact_id = ?
      ORDER BY a.activity_date DESC
      LIMIT 20
    `, [contactId]);

    return NextResponse.json({ contact, activities });
  } catch (error: any) {
    console.error('Get contact error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/contacts/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const contactId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<CRMContact>('SELECT * FROM crm_contacts WHERE id = ?', [contactId]);
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const allowedFields = [
      'first_name', 'last_name', 'email', 'phone', 'mobile', 'job_title',
      'company_id', 'owner_id', 'is_primary', 'notes', 'tags', 'custom_fields',
      'linkedin_url', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'
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

    values.push(contactId);
    await query(`UPDATE crm_contacts SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'contact',
      entity_id: contactId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<CRMContact>('SELECT * FROM crm_contacts WHERE id = ?', [contactId]);
    return NextResponse.json({ success: true, contact: updated });
  } catch (error: any) {
    console.error('Update contact error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/contacts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const contactId = parseInt(id);

    const existing = await queryOne<CRMContact>('SELECT * FROM crm_contacts WHERE id = ?', [contactId]);
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await query('DELETE FROM crm_contacts WHERE id = ?', [contactId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'contact',
      entity_id: contactId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete contact error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
