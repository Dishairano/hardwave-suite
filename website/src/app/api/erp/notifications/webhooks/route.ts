import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import crypto from 'crypto';

// GET /api/erp/notifications/webhooks - List webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'settings', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const activeOnly = searchParams.get('active') !== 'false';

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (activeOnly) {
      whereClause += ' AND w.is_active = TRUE';
    }

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM erp_webhook_subscriptions w ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        w.*,
        u.display_name as created_by_name
      FROM erp_webhook_subscriptions w
      LEFT JOIN users u ON w.created_by = u.id
      ${whereClause}
      ORDER BY w.created_at DESC LIMIT ? OFFSET ?
    `;

    const webhooks = await query<any[]>(sql, [...params, limit, offset]);

    const parsedWebhooks = webhooks.map(w => ({
      ...w,
      events: typeof w.events === 'string' ? JSON.parse(w.events) : w.events,
      headers: typeof w.headers === 'string' ? JSON.parse(w.headers) : w.headers,
      secret_key: w.secret_key ? '****' + w.secret_key.slice(-4) : null, // Mask secret
    }));

    return NextResponse.json(buildPaginationResponse(parsedWebhooks, total, page, limit));
  } catch (error: any) {
    console.error('Get webhooks error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/notifications/webhooks - Create webhook subscription
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const {
      name,
      url,
      events,
      headers,
      generate_secret = true,
    } = body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'name, url, and events array are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Generate secret key for signature verification
    const secretKey = generate_secret
      ? crypto.randomBytes(32).toString('hex')
      : null;

    const result = await query<any>(`
      INSERT INTO erp_webhook_subscriptions (name, url, secret_key, events, headers, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      name,
      url,
      secretKey,
      JSON.stringify(events),
      headers ? JSON.stringify(headers) : null,
      auth.userId,
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'create',
      entity_type: 'webhook_subscription',
      entity_id: result.insertId,
      new_values: { name, url, events },
      ip_address: getClientIP(request),
    });

    const webhook = await queryOne<any>(
      'SELECT * FROM erp_webhook_subscriptions WHERE id = ?',
      [result.insertId]
    );

    return NextResponse.json({
      success: true,
      webhook: {
        ...webhook,
        events: JSON.parse(webhook.events),
        headers: webhook.headers ? JSON.parse(webhook.headers) : null,
        // Only show full secret on creation
        secret_key: secretKey,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create webhook error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/notifications/webhooks - Update webhook subscription
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const { id, name, url, events, headers, is_active, regenerate_secret } = body;

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 });
    }

    const existing = await queryOne<any>(
      'SELECT * FROM erp_webhook_subscriptions WHERE id = ?',
      [id]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let newSecret: string | null = null;

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }

    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
      updates.push('url = ?');
      values.push(url);
    }

    if (events !== undefined) {
      updates.push('events = ?');
      values.push(JSON.stringify(events));
    }

    if (headers !== undefined) {
      updates.push('headers = ?');
      values.push(headers ? JSON.stringify(headers) : null);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (regenerate_secret) {
      newSecret = crypto.randomBytes(32).toString('hex');
      updates.push('secret_key = ?');
      values.push(newSecret);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(id);
    await query(`UPDATE erp_webhook_subscriptions SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'update',
      entity_type: 'webhook_subscription',
      entity_id: id,
      new_values: { name, url, events, is_active },
      ip_address: getClientIP(request),
    });

    const webhook = await queryOne<any>(
      'SELECT * FROM erp_webhook_subscriptions WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      webhook: {
        ...webhook,
        events: JSON.parse(webhook.events),
        headers: webhook.headers ? JSON.parse(webhook.headers) : null,
        secret_key: newSecret || (webhook.secret_key ? '****' + webhook.secret_key.slice(-4) : null),
      },
      new_secret: newSecret, // Only provided if regenerated
    });
  } catch (error: any) {
    console.error('Update webhook error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/notifications/webhooks - Delete webhook subscription
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 });
    }

    const existing = await queryOne<any>(
      'SELECT * FROM erp_webhook_subscriptions WHERE id = ?',
      [parseInt(id)]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    await query('DELETE FROM erp_webhook_subscriptions WHERE id = ?', [parseInt(id)]);

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'delete',
      entity_type: 'webhook_subscription',
      entity_id: parseInt(id),
      old_values: { name: existing.name, url: existing.url },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
