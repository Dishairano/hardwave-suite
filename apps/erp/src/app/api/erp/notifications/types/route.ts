import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/notifications/types - List notification types (admin)
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');
    const activeOnly = searchParams.get('active') !== 'false';

    let sql = 'SELECT * FROM erp_notification_types WHERE 1=1';
    const params: any[] = [];

    if (module) {
      sql += ' AND module = ?';
      params.push(module);
    }

    if (activeOnly) {
      sql += ' AND is_active = TRUE';
    }

    sql += ' ORDER BY module, name';

    const types = await query<any[]>(sql, params);

    const parsedTypes = types.map(t => ({
      ...t,
      default_channels: typeof t.default_channels === 'string'
        ? JSON.parse(t.default_channels)
        : t.default_channels,
    }));

    return NextResponse.json({ types: parsedTypes });
  } catch (error: any) {
    console.error('Get notification types error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/notifications/types - Create notification type (admin)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const {
      code,
      name,
      description,
      module,
      template_subject,
      template_body,
      default_channels = ['in_app'],
    } = body;

    if (!code || !name || !module) {
      return NextResponse.json(
        { error: 'code, name, and module are required' },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM erp_notification_types WHERE code = ?',
      [code]
    );
    if (existing) {
      return NextResponse.json({ error: 'Notification type code already exists' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO erp_notification_types (code, name, description, module, template_subject, template_body, default_channels)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      code,
      name,
      description || null,
      module,
      template_subject || null,
      template_body || null,
      JSON.stringify(default_channels),
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'create',
      entity_type: 'notification_type',
      entity_id: result.insertId,
      new_values: { code, name, module },
      ip_address: getClientIP(request),
    });

    const notificationType = await queryOne<any>(
      'SELECT * FROM erp_notification_types WHERE id = ?',
      [result.insertId]
    );

    return NextResponse.json({ success: true, type: notificationType }, { status: 201 });
  } catch (error: any) {
    console.error('Create notification type error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
