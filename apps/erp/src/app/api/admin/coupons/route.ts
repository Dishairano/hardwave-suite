import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;

    const users = await query<any[]>(
      'SELECT id, is_admin FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_admin) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const coupons = await query<any[]>(`
      SELECT * FROM coupons
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch coupons' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { code, discountType, discountValue, maxUses, expiresAt } = await request.json();

    // Validate inputs
    if (!code || !discountType || !discountValue) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Check if coupon code already exists
    const existing = await query<any[]>('SELECT id FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Coupon code already exists' }, { status: 400 });
    }

    const result = await query<any>(
      `INSERT INTO coupons (code, discount_type, discount_value, max_uses, uses_count, expires_at, is_active, created_at)
       VALUES (?, ?, ?, ?, 0, ?, 1, NOW())`,
      [code.toUpperCase(), discountType, discountValue, maxUses || null, expiresAt || null]
    );

    // Log the action
    await query(
      'INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [admin.userId, 'create_coupon', 'coupon', result.insertId, JSON.stringify({ code, discountType, discountValue, maxUses, expiresAt })]
    );

    return NextResponse.json({
      success: true,
      coupon: {
        id: result.insertId,
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: discountValue,
        max_uses: maxUses,
        uses_count: 0,
        expires_at: expiresAt,
        is_active: true
      }
    });
  } catch (error) {
    console.error('Error creating coupon:', error);
    return NextResponse.json({ success: false, error: 'Failed to create coupon' }, { status: 500 });
  }
}
