import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/crm/pipeline-stages/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'crm', 'read');
    const { id } = await params;

    const stage = await queryOne<any>(`
      SELECT s.*, p.name as pipeline_name
      FROM crm_pipeline_stages s
      JOIN crm_pipelines p ON s.pipeline_id = p.id
      WHERE s.id = ?
    `, [parseInt(id)]);

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    return NextResponse.json({ stage });
  } catch (error: any) {
    console.error('Get pipeline stage error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/crm/pipeline-stages/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'write');
    const { id } = await params;
    const stageId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<any>('SELECT * FROM crm_pipeline_stages WHERE id = ?', [stageId]);
    if (!existing) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    const allowedFields = ['name', 'probability', 'sort_order', 'color'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(stageId);
    await query(`UPDATE crm_pipeline_stages SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'update',
      entity_type: 'pipeline_stage',
      entity_id: stageId,
      old_values: sanitizeForAudit(existing),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<any>('SELECT * FROM crm_pipeline_stages WHERE id = ?', [stageId]);
    return NextResponse.json({ success: true, stage: updated });
  } catch (error: any) {
    console.error('Update pipeline stage error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/crm/pipeline-stages/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'crm', 'delete');
    const { id } = await params;
    const stageId = parseInt(id);

    const existing = await queryOne<any>('SELECT * FROM crm_pipeline_stages WHERE id = ?', [stageId]);
    if (!existing) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    const deals = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM crm_deals WHERE stage_id = ?', [stageId]);
    if (deals && deals.count > 0) {
      return NextResponse.json({ error: 'Cannot delete stage with deals' }, { status: 400 });
    }

    await query('DELETE FROM crm_pipeline_stages WHERE id = ?', [stageId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'crm',
      action: 'delete',
      entity_type: 'pipeline_stage',
      entity_id: stageId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete pipeline stage error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
