import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, verifyERPAuth, logERPAction, getClientIP, buildPaginationResponse, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/notifications - List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const unreadOnly = searchParams.get('unread') === 'true';
    const module = searchParams.get('module');
    const severity = searchParams.get('severity');

    let whereClause = ' WHERE n.user_id = ? AND (n.expires_at IS NULL OR n.expires_at > NOW())';
    const params: any[] = [auth.userId];

    if (unreadOnly) {
      whereClause += ' AND n.is_read = FALSE';
    }

    if (module) {
      whereClause += ' AND n.module = ?';
      params.push(module);
    }

    if (severity) {
      whereClause += ' AND n.severity = ?';
      params.push(severity);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM erp_notifications n ${whereClause}`, params
    );
    const total = countResult?.total || 0;

    // Get unread count
    const unreadResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM erp_notifications WHERE user_id = ? AND is_read = FALSE AND (expires_at IS NULL OR expires_at > NOW())',
      [auth.userId]
    );
    const unreadCount = unreadResult?.count || 0;

    const sql = `
      SELECT
        n.*,
        nt.code as type_code,
        nt.name as type_name
      FROM erp_notifications n
      LEFT JOIN erp_notification_types nt ON n.notification_type_id = nt.id
      ${whereClause}
      ORDER BY n.created_at DESC LIMIT ? OFFSET ?
    `;

    const notifications = await query<any[]>(sql, [...params, limit, offset]);

    const parsedNotifications = notifications.map(n => ({
      ...n,
      metadata: typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata,
    }));

    return NextResponse.json({
      ...buildPaginationResponse(parsedNotifications, total, page, limit),
      unread_count: unreadCount,
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/notifications - Create notification (internal/admin use)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'settings', 'write');
    const body = await request.json();

    const {
      user_id,
      user_ids, // For bulk notifications
      notification_type_code,
      title,
      message,
      module,
      severity = 'info',
      entity_type,
      entity_id,
      action_url,
      action_label,
      metadata,
      expires_at,
    } = body;

    if (!title || !message || !module) {
      return NextResponse.json(
        { error: 'title, message, and module are required' },
        { status: 400 }
      );
    }

    // Get notification type if provided
    let notificationTypeId = null;
    if (notification_type_code) {
      const notificationType = await queryOne<{ id: number }>(
        'SELECT id FROM erp_notification_types WHERE code = ?',
        [notification_type_code]
      );
      notificationTypeId = notificationType?.id;
    }

    const targetUserIds = user_ids || (user_id ? [user_id] : []);

    if (targetUserIds.length === 0) {
      return NextResponse.json(
        { error: 'user_id or user_ids is required' },
        { status: 400 }
      );
    }

    const createdIds: number[] = [];

    for (const targetUserId of targetUserIds) {
      const result = await query<any>(`
        INSERT INTO erp_notifications (
          user_id, notification_type_id, title, message, module, severity,
          entity_type, entity_id, action_url, action_label, metadata, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        targetUserId,
        notificationTypeId,
        title,
        message,
        module,
        severity,
        entity_type || null,
        entity_id || null,
        action_url || null,
        action_label || null,
        metadata ? JSON.stringify(metadata) : null,
        expires_at || null,
      ]);

      createdIds.push(result.insertId);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'create_notification',
      entity_type: 'notification',
      new_values: { title, module, user_count: targetUserIds.length },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({
      success: true,
      notification_ids: createdIds,
      count: createdIds.length,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create notification error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notification_ids, mark_all_read } = body;

    if (mark_all_read) {
      await query(
        'UPDATE erp_notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
        [auth.userId]
      );
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!notification_ids || !Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: 'notification_ids array or mark_all_read is required' },
        { status: 400 }
      );
    }

    const placeholders = notification_ids.map(() => '?').join(',');
    await query(
      `UPDATE erp_notifications SET is_read = TRUE, read_at = NOW() WHERE id IN (${placeholders}) AND user_id = ?`,
      [...notification_ids, auth.userId]
    );

    return NextResponse.json({ success: true, count: notification_ids.length });
  } catch (error: any) {
    console.error('Mark notifications read error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationIds = searchParams.get('ids')?.split(',').map(id => parseInt(id));
    const deleteAll = searchParams.get('all') === 'true';
    const deleteRead = searchParams.get('read') === 'true';

    if (deleteAll) {
      await query('DELETE FROM erp_notifications WHERE user_id = ?', [auth.userId]);
      return NextResponse.json({ success: true, message: 'All notifications deleted' });
    }

    if (deleteRead) {
      await query('DELETE FROM erp_notifications WHERE user_id = ? AND is_read = TRUE', [auth.userId]);
      return NextResponse.json({ success: true, message: 'Read notifications deleted' });
    }

    if (!notificationIds || notificationIds.length === 0) {
      return NextResponse.json({ error: 'ids parameter required' }, { status: 400 });
    }

    const placeholders = notificationIds.map(() => '?').join(',');
    await query(
      `DELETE FROM erp_notifications WHERE id IN (${placeholders}) AND user_id = ?`,
      [...notificationIds, auth.userId]
    );

    return NextResponse.json({ success: true, count: notificationIds.length });
  } catch (error: any) {
    console.error('Delete notifications error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
