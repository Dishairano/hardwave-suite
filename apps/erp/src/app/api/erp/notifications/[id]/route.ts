import { NextRequest, NextResponse } from 'next/server';
import { verifyERPAuth } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/notifications/[id] - Get single notification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const notificationId = parseInt(id);

    const notification = await queryOne<any>(`
      SELECT
        n.*,
        nt.code as type_code,
        nt.name as type_name
      FROM erp_notifications n
      LEFT JOIN erp_notification_types nt ON n.notification_type_id = nt.id
      WHERE n.id = ? AND n.user_id = ?
    `, [notificationId, auth.userId]);

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Mark as read when viewed
    if (!notification.is_read) {
      await query(
        'UPDATE erp_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
        [notificationId]
      );
      notification.is_read = true;
      notification.read_at = new Date().toISOString();
    }

    return NextResponse.json({
      notification: {
        ...notification,
        metadata: typeof notification.metadata === 'string'
          ? JSON.parse(notification.metadata)
          : notification.metadata,
      },
    });
  } catch (error: any) {
    console.error('Get notification error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/notifications/[id] - Delete single notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const notificationId = parseInt(id);

    const existing = await queryOne<{ id: number }>(
      'SELECT id FROM erp_notifications WHERE id = ? AND user_id = ?',
      [notificationId, auth.userId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await query('DELETE FROM erp_notifications WHERE id = ?', [notificationId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete notification error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
