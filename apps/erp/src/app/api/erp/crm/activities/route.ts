import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/activities
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const contactId = searchParams.get('contact_id');
    const companyId = searchParams.get('company_id');
    const dealId = searchParams.get('deal_id');
    const activityType = searchParams.get('type');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (contactId) {
      whereClause += ' AND a.contact_id = ?';
      params.push(parseInt(contactId));
    }
    if (companyId) {
      whereClause += ' AND a.company_id = ?';
      params.push(parseInt(companyId));
    }
    if (dealId) {
      whereClause += ' AND a.deal_id = ?';
      params.push(parseInt(dealId));
    }
    if (activityType) {
      whereClause += ' AND a.activity_type = ?';
      params.push(activityType);
    }

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM crm_activities a ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT a.*,
        u.display_name as user_name,
        c.first_name as contact_first_name, c.last_name as contact_last_name,
        comp.name as company_name,
        d.name as deal_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN crm_contacts c ON a.contact_id = c.id
      LEFT JOIN crm_companies comp ON a.company_id = comp.id
      LEFT JOIN crm_deals d ON a.deal_id = d.id
      ${whereClause} ORDER BY a.activity_date DESC, a.created_at DESC LIMIT ? OFFSET ?`;

    const activities = await query<any[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(activities, total, page, limit));
  } catch (error: any) {
    console.error('Get activities error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/activities
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const {
      activity_type, subject, description, activity_date,
      contact_id, company_id, deal_id, duration_minutes, outcome, next_action
    } = body;

    if (!activity_type || !subject) {
      return NextResponse.json({ error: 'activity_type and subject are required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO crm_activities (
        activity_type, subject, description, activity_date, contact_id,
        company_id, deal_id, user_id, duration_minutes, outcome, next_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      activity_type, subject, description || null,
      activity_date || new Date().toISOString().split('T')[0],
      contact_id || null, company_id || null, deal_id || null,
      auth.userId, duration_minutes || null, outcome || null, next_action || null
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'activity',
      entity_id: result.insertId,
      new_values: { activity_type, subject },
      ip_address: getClientIP(request),
    });

    const activity = await queryOne<any>('SELECT * FROM crm_activities WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, activity }, { status: 201 });
  } catch (error: any) {
    console.error('Create activity error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
