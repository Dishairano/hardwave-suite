import { NextRequest, NextResponse } from 'next/server';
import { verifyERPAuth, logERPAction, getClientIP } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/notifications/preferences - Get user notification preferences
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all notification types
    const types = await query<any[]>(`
      SELECT
        nt.id,
        nt.code,
        nt.name,
        nt.description,
        nt.module,
        nt.default_channels,
        COALESCE(np.channels, nt.default_channels) as channels,
        COALESCE(np.is_enabled, TRUE) as is_enabled
      FROM erp_notification_types nt
      LEFT JOIN erp_notification_preferences np ON np.notification_type_id = nt.id AND np.user_id = ?
      WHERE nt.is_active = TRUE
      ORDER BY nt.module, nt.name
    `, [auth.userId]);

    // Group by module
    const grouped = types.reduce((acc: any, type) => {
      if (!acc[type.module]) {
        acc[type.module] = [];
      }
      acc[type.module].push({
        ...type,
        default_channels: typeof type.default_channels === 'string'
          ? JSON.parse(type.default_channels)
          : type.default_channels,
        channels: typeof type.channels === 'string'
          ? JSON.parse(type.channels)
          : type.channels,
      });
      return acc;
    }, {});

    return NextResponse.json({ preferences: grouped });
  } catch (error: any) {
    console.error('Get notification preferences error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/erp/notifications/preferences - Update user notification preferences
export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyERPAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || !Array.isArray(preferences)) {
      return NextResponse.json(
        { error: 'preferences array is required' },
        { status: 400 }
      );
    }

    for (const pref of preferences) {
      const { notification_type_id, channels, is_enabled } = pref;

      if (!notification_type_id) continue;

      // Upsert preference
      await query(`
        INSERT INTO erp_notification_preferences (user_id, notification_type_id, channels, is_enabled)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE channels = VALUES(channels), is_enabled = VALUES(is_enabled)
      `, [
        auth.userId,
        notification_type_id,
        JSON.stringify(channels || ['in_app']),
        is_enabled !== false,
      ]);
    }

    await logERPAction({
      user_id: auth.userId,
      module: 'settings',
      action: 'update_notification_preferences',
      entity_type: 'notification_preferences',
      new_values: { updated_count: preferences.length },
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true, updated: preferences.length });
  } catch (error: any) {
    console.error('Update notification preferences error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
