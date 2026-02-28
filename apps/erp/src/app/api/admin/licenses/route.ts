import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

function generateLicenseKey(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `HW-${segments.join('-')}`;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const licenses = await query<any[]>(`
      SELECT l.*, u.email as user_email, u.display_name as user_name
      FROM licenses l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ success: true, licenses });
  } catch (error) {
    console.error('Error fetching licenses:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch licenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId, type } = await request.json();
    const licenseKey = generateLicenseKey();

    const result = await query<any>(
      'INSERT INTO licenses (user_id, license_key, type, status, created_at) VALUES (?, ?, ?, ?, NOW())',
      [userId || null, licenseKey, type || 'pro', 'active']
    );

    // Log the action
    await query(
      'INSERT INTO audit_log (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)',
      [admin.userId, 'generate_license', 'license', result.insertId, JSON.stringify({ userId, type, licenseKey })]
    );

    return NextResponse.json({
      success: true,
      license: {
        id: result.insertId,
        license_key: licenseKey,
        user_id: userId,
        type: type || 'pro',
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Error generating license:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate license' }, { status: 500 });
  }
}
