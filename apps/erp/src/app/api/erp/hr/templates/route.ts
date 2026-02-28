import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query } from '@/lib/db';

// GET /api/erp/hr/templates
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let sql = `
      SELECT t.*,
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM hr_document_templates t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (type) {
      sql += ' AND t.document_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY t.name ASC';

    const templates = await query<any[]>(sql, params);
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Get templates error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/templates
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const body = await request.json();

    const { name, document_type, title_template, description_template, content, is_active } = body;

    if (!name || !document_type || !title_template) {
      return NextResponse.json({ error: 'Name, document type, and title template are required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO hr_document_templates
        (name, document_type, title_template, description_template, content, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      document_type,
      title_template,
      description_template || null,
      content || null,
      is_active !== undefined ? is_active : true,
      auth.userId
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'document_template',
      entity_id: result.insertId,
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Create template error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
