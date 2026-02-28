import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildPaginationResponse, parseJsonField } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/settings/audit-log - List audit log entries
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const userId = searchParams.get('user_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (module) {
      whereClause += ' AND a.module = ?';
      params.push(module);
    }

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(action);
    }

    if (entityType) {
      whereClause += ' AND a.entity_type = ?';
      params.push(entityType);
    }

    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(parseInt(userId));
    }

    if (startDate) {
      whereClause += ' AND a.created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND a.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM erp_audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Main query with ordering and pagination
    const sql = `
      SELECT
        a.*,
        u.display_name as user_name,
        u.email as user_email
      FROM erp_audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause} ORDER BY a.created_at DESC LIMIT ? OFFSET ?
    `;

    const entries = await query<any[]>(sql, [...params, limit, offset]);

    // Parse JSON fields
    const parsedEntries = entries.map(entry => ({
      ...entry,
      old_values: parseJsonField(entry.old_values, null),
      new_values: parseJsonField(entry.new_values, null),
    }));

    // Get filter options
    const modules = await query<any[]>('SELECT DISTINCT module FROM erp_audit_log ORDER BY module');
    const actions = await query<any[]>('SELECT DISTINCT action FROM erp_audit_log ORDER BY action');
    const entityTypes = await query<any[]>('SELECT DISTINCT entity_type FROM erp_audit_log ORDER BY entity_type');

    return NextResponse.json({
      ...buildPaginationResponse(parsedEntries, total, page, limit),
      filters: {
        modules: modules.map(m => m.module),
        actions: actions.map(a => a.action),
        entityTypes: entityTypes.map(e => e.entity_type),
      },
    });
  } catch (error: any) {
    console.error('Get audit log error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
