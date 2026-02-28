import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/pipeline-stages
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipeline_id');

    let sql = `
      SELECT s.*, p.name as pipeline_name,
        (SELECT COUNT(*) FROM crm_deals WHERE stage_id = s.id AND actual_close_date IS NULL) as deal_count
      FROM crm_pipeline_stages s
      JOIN crm_pipelines p ON s.pipeline_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (pipelineId) {
      sql += ' AND s.pipeline_id = ?';
      params.push(parseInt(pipelineId));
    }

    sql += ' ORDER BY p.name, s.sort_order';

    const stages = await query<any[]>(sql, params);

    return NextResponse.json({ stages });
  } catch (error: any) {
    console.error('Get pipeline stages error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/crm/pipeline-stages
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const body = await request.json();

    const { pipeline_id, name, probability = 0, sort_order, color } = body;

    if (!pipeline_id || !name) {
      return NextResponse.json({ error: 'pipeline_id and name are required' }, { status: 400 });
    }

    // Get max sort_order if not provided
    let order = sort_order;
    if (order === undefined) {
      const max = await queryOne<{ max_order: number }>(
        'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM crm_pipeline_stages WHERE pipeline_id = ?',
        [pipeline_id]
      );
      order = (max?.max_order || 0) + 1;
    }

    const result = await query<any>(`
      INSERT INTO crm_pipeline_stages (pipeline_id, name, probability, sort_order, color)
      VALUES (?, ?, ?, ?, ?)
    `, [pipeline_id, name, probability, order, color || '#6B7280']);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'create',
      entity_type: 'pipeline_stage',
      entity_id: result.insertId,
      new_values: { pipeline_id, name },
      ip_address: getClientIP(request),
    });

    const stage = await queryOne<any>('SELECT * FROM crm_pipeline_stages WHERE id = ?', [result.insertId]);

    return NextResponse.json({ success: true, stage }, { status: 201 });
  } catch (error: any) {
    console.error('Create pipeline stage error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
