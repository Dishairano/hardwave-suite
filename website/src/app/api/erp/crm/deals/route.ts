import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getNextSequence, getClientIP, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { CRMDeal } from '@/lib/erp-types';

// GET /api/erp/crm/deals - List deals
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const pipelineId = searchParams.get('pipeline_id');
    const stageId = searchParams.get('stage_id');
    const ownerId = searchParams.get('owner_id');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (d.name LIKE ? OR d.deal_number LIKE ? OR co.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (pipelineId) {
      whereClause += ' AND d.pipeline_id = ?';
      params.push(parseInt(pipelineId));
    }

    if (stageId) {
      whereClause += ' AND d.stage_id = ?';
      params.push(parseInt(stageId));
    }

    if (ownerId) {
      if (ownerId === 'me') {
        whereClause += ' AND d.owner_id = ?';
        params.push(auth.userId);
      } else {
        whereClause += ' AND d.owner_id = ?';
        params.push(parseInt(ownerId));
      }
    }

    // Get total count and value
    const countResult = await queryOne<{ total: number; total_value: number }>(
      `SELECT COUNT(*) as total, SUM(d.amount) as total_value FROM crm_deals d
      LEFT JOIN crm_companies co ON d.company_id = co.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;
    const totalValue = countResult?.total_value || 0;

    const sql = `
      SELECT
        d.*,
        co.name as company_name,
        ct.first_name as contact_first_name,
        ct.last_name as contact_last_name,
        CONCAT(ct.first_name, ' ', COALESCE(ct.last_name, '')) as contact_name,
        p.name as pipeline_name,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.probability as stage_probability,
        u.display_name as owner_name
      FROM crm_deals d
      LEFT JOIN crm_companies co ON d.company_id = co.id
      LEFT JOIN crm_contacts ct ON d.contact_id = ct.id
      JOIN crm_pipelines p ON d.pipeline_id = p.id
      JOIN crm_pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN users u ON d.owner_id = u.id
      ${whereClause} ORDER BY ps.sort_order, d.expected_close_date ASC LIMIT ? OFFSET ?`;

    const deals = await query<any[]>(sql, [...params, limit, offset]);

    // Parse JSON fields
    const parsedDeals = deals.map(deal => ({
      ...deal,
      tags: parseJsonField(deal.tags, []),
      custom_fields: parseJsonField(deal.custom_fields, {}),
    }));

    return NextResponse.json({
      ...buildPaginationResponse(parsedDeals, total, page, limit),
      summary: { totalValue },
    });
  } catch (error: any) {
    console.error('Get deals error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/deals - Create deal
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const {
      name,
      company_id,
      contact_id,
      pipeline_id,
      stage_id,
      amount = 0,
      currency = 'USD',
      expected_close_date,
      source,
      description,
      next_step,
      tags = [],
      custom_fields = {},
    } = body;

    if (!name || !pipeline_id || !stage_id) {
      return NextResponse.json({ error: 'Name, pipeline, and stage are required' }, { status: 400 });
    }

    // Get stage probability
    const stage = await queryOne<{ probability: number }>(`
      SELECT probability FROM crm_pipeline_stages WHERE id = ?
    `, [stage_id]);

    const dealNumber = await getNextSequence('deal');

    const result = await query<any>(`
      INSERT INTO crm_deals (
        deal_number, name, company_id, contact_id, pipeline_id, stage_id,
        owner_id, amount, currency, probability, expected_close_date,
        source, description, next_step, tags, custom_fields
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dealNumber,
      name,
      company_id || null,
      contact_id || null,
      pipeline_id,
      stage_id,
      auth.userId,
      amount,
      currency,
      stage?.probability || 0,
      expected_close_date || null,
      source || null,
      description || null,
      next_step || null,
      JSON.stringify(tags),
      JSON.stringify(custom_fields),
    ]);

    const dealId = result.insertId;

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'deal',
      entity_id: dealId,
      new_values: { deal_number: dealNumber, name, amount },
      ip_address: getClientIP(request),
    });

    const deal = await queryOne<CRMDeal>(`
      SELECT d.*, ps.name as stage_name, co.name as company_name
      FROM crm_deals d
      JOIN crm_pipeline_stages ps ON d.stage_id = ps.id
      LEFT JOIN crm_companies co ON d.company_id = co.id
      WHERE d.id = ?
    `, [dealId]);

    return NextResponse.json({ success: true, deal }, { status: 201 });
  } catch (error: any) {
    console.error('Create deal error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
