import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMContact } from '@/lib/erp-types';

// GET /api/erp/crm/contacts - List contacts
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const companyId = searchParams.get('company_id');
    const leadStatus = searchParams.get('lead_status');
    const ownerId = searchParams.get('owner_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (
        c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ?
        OR c.phone LIKE ? OR c.job_title LIKE ? OR co.name LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (companyId) {
      whereClause += ' AND c.company_id = ?';
      params.push(parseInt(companyId));
    }

    if (leadStatus) {
      whereClause += ' AND c.lead_status = ?';
      params.push(leadStatus);
    }

    if (ownerId) {
      if (ownerId === 'me') {
        whereClause += ' AND c.owner_id = ?';
        params.push(auth.userId);
      } else {
        whereClause += ' AND c.owner_id = ?';
        params.push(parseInt(ownerId));
      }
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM crm_contacts c
      LEFT JOIN crm_companies co ON c.company_id = co.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        c.*,
        co.name as company_name,
        u.display_name as owner_name
      FROM crm_contacts c
      LEFT JOIN crm_companies co ON c.company_id = co.id
      LEFT JOIN users u ON c.owner_id = u.id
      ${whereClause} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;

    const contacts = await query<any[]>(sql, [...params, limit, offset]);

    // Parse JSON fields
    const parsedContacts = contacts.map(contact => ({
      ...contact,
      tags: parseJsonField(contact.tags, []),
      custom_fields: parseJsonField(contact.custom_fields, {}),
    }));

    return NextResponse.json(buildPaginationResponse(parsedContacts, total, page, limit));
  } catch (error: any) {
    console.error('Get contacts error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/contacts - Create contact
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const {
      company_id,
      first_name,
      last_name,
      email,
      phone,
      mobile,
      job_title,
      department,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      linkedin_url,
      twitter_url,
      lead_source,
      lead_status = 'new',
      is_primary_contact = false,
      notes,
      tags = [],
      custom_fields = {},
    } = body;

    if (!first_name) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO crm_contacts (
        company_id, first_name, last_name, email, phone, mobile,
        job_title, department, address_line1, address_line2, city,
        state, postal_code, country, linkedin_url, twitter_url,
        lead_source, lead_status, owner_id, is_primary_contact,
        notes, tags, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      company_id || null,
      first_name,
      last_name || null,
      email || null,
      phone || null,
      mobile || null,
      job_title || null,
      department || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state || null,
      postal_code || null,
      country || null,
      linkedin_url || null,
      twitter_url || null,
      lead_source || null,
      lead_status,
      auth.userId,
      is_primary_contact,
      notes || null,
      JSON.stringify(tags),
      JSON.stringify(custom_fields),
    ]);

    const contactId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'contact',
      entity_id: contactId,
      new_values: { first_name, last_name, email },
      ip_address: getClientIP(request),
    });

    const contact = await queryOne<CRMContact>(`
      SELECT c.*, co.name as company_name
      FROM crm_contacts c
      LEFT JOIN crm_companies co ON c.company_id = co.id
      WHERE c.id = ?
    `, [contactId]);

    return NextResponse.json({ success: true, contact }, { status: 201 });
  } catch (error: any) {
    console.error('Create contact error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
