import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/pipelines/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;

    const pipeline = await queryOne<any>('SELECT * FROM crm_pipelines WHERE id = ?', [parseInt(id)]);
    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const stages = await query<any[]>(`
      SELECT s.*,
        (SELECT COUNT(*) FROM crm_deals WHERE stage_id = s.id AND actual_close_date IS NULL) as deal_count,
        (SELECT COALESCE(SUM(value), 0) FROM crm_deals WHERE stage_id = s.id AND actual_close_date IS NULL) as total_value
      FROM crm_pipeline_stages s
      WHERE s.pipeline_id = ?
      ORDER BY s.sort_order
    `, [parseInt(id)]);

    return NextResponse.json({ pipeline, stages });
  } catch (error: any) {
    console.error('Get pipeline error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/pipelines/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const pipelineId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM crm_pipelines WHERE id = ?', [pipelineId]);
    if (!existing) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'description', 'is_default'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (body.is_default === true) {
      await query('UPDATE crm_pipelines SET is_default = FALSE WHERE id != ?', [pipelineId]);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(pipelineId);
    await query(`UPDATE crm_pipelines SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'pipeline',
      entity_id: pipelineId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM crm_pipelines WHERE id = ?', [pipelineId]);
    return NextResponse.json({ success: true, pipeline: updated });
  } catch (error: any) {
    console.error('Update pipeline error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/pipelines/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const pipelineId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM crm_pipelines WHERE id = ?', [pipelineId]);
    if (!existing) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Check for deals
    const deals = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM crm_deals d
      JOIN crm_pipeline_stages s ON d.stage_id = s.id
      WHERE s.pipeline_id = ?
    `, [pipelineId]);
    if (deals && deals.count > 0) {
      return NextResponse.json({ error: 'Cannot delete pipeline with deals' }, { status: 400 });
    }

    await query('DELETE FROM crm_pipelines WHERE id = ?', [pipelineId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'pipeline',
      entity_id: pipelineId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete pipeline error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
