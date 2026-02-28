import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMCompany } from '@/lib/erp-types';

// GET /api/erp/crm/companies - List companies
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const industry = searchParams.get('industry');
    const ownerId = searchParams.get('owner_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.domain LIKE ? OR c.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (industry) {
      whereClause += ' AND c.industry = ?';
      params.push(industry);
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
      `SELECT COUNT(*) as total FROM crm_companies c ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        c.*,
        u.display_name as owner_name,
        (SELECT COUNT(*) FROM crm_contacts WHERE company_id = c.id) as contacts_count,
        (SELECT COUNT(*) FROM crm_deals WHERE company_id = c.id) as deals_count
      FROM crm_companies c
      LEFT JOIN users u ON c.owner_id = u.id
      ${whereClause} ORDER BY c.name ASC LIMIT ? OFFSET ?`;

    const companies = await query<any[]>(sql, [...params, limit, offset]);

    const parsedCompanies = companies.map(company => ({
      ...company,
      tags: parseJsonField(company.tags, []),
      custom_fields: parseJsonField(company.custom_fields, {}),
    }));

    return NextResponse.json(buildPaginationResponse(parsedCompanies, total, page, limit));
  } catch (error: any) {
    console.error('Get companies error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/companies - Create company
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const {
      name,
      domain,
      industry,
      company_size,
      annual_revenue,
      website,
      phone,
      email,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      description,
      linkedin_url,
      twitter_url,
      source,
      tags = [],
      custom_fields = {},
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO crm_companies (
        name, domain, industry, company_size, annual_revenue,
        website, phone, email, address_line1, address_line2,
        city, state, postal_code, country, description,
        linkedin_url, twitter_url, owner_id, source, tags, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      domain || null,
      industry || null,
      company_size || null,
      annual_revenue || null,
      website || null,
      phone || null,
      email || null,
      address_line1 || null,
      address_line2 || null,
      city || null,
      state || null,
      postal_code || null,
      country || 'United States',
      description || null,
      linkedin_url || null,
      twitter_url || null,
      auth.userId,
      source || null,
      JSON.stringify(tags),
      JSON.stringify(custom_fields),
    ]);

    const companyId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'company',
      entity_id: companyId,
      new_values: { name, domain, industry },
      ip_address: getClientIP(request),
    });

    const company = await queryOne<CRMCompany>('SELECT * FROM crm_companies WHERE id = ?', [companyId]);

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (error: any) {
    console.error('Create company error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
