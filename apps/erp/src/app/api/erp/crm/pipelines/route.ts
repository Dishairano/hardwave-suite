import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/pipelines
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'crm', 'read');

    const pipelines = await query<any[]>(`
      SELECT p.*,
        (SELECT COUNT(*) FROM crm_pipeline_stages WHERE pipeline_id = p.id) as stage_count,
        (SELECT COUNT(*) FROM crm_deals d JOIN crm_pipeline_stages s ON d.stage_id = s.id WHERE s.pipeline_id = p.id AND d.actual_close_date IS NULL) as active_deals
      FROM crm_pipelines p
      ORDER BY p.is_default DESC, p.name
    `);

    return NextResponse.json({ pipelines });
  } catch (error: any) {
    console.error('Get pipelines error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/pipelines
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const { name, description, is_default = false } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await query('UPDATE crm_pipelines SET is_default = FALSE');
    }

    const result = await query<any>(`
      INSERT INTO crm_pipelines (name, description, is_default)
      VALUES (?, ?, ?)
    `, [name, description || null, is_default]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'pipeline',
      entity_id: result.insertId,
      new_values: { name },
      ip_address: getClientIP(request),
    });

    const pipeline = await queryOne<any>('SELECT * FROM crm_pipelines WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, pipeline }, { status: 201 });
  } catch (error: any) {
    console.error('Create pipeline error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
