import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import jwt from 'jsonwebtoken';

// Try multiple JWT secrets for compatibility
const JWT_SECRETS = [
  process.env.JWT_SECRET,
  'fac145d3a9411841b586ef836eede9050286a1643c42a6c5ba650741d229c16e',
  'your_super_secure_jwt_secret_key',
  'your_secret_key'
].filter(Boolean) as string[];

function getUserId(request: NextRequest): number | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);

  for (const secret of JWT_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret) as any;
      return decoded.userId;
    } catch {
      continue;
    }
  }
  return null;
}

// GET /api/library/collections
export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const collections = await query(`
      SELECT c.id, c.user_id, c.collection_name as name, c.description, c.color, c.created_at,
        (SELECT COUNT(*) FROM user_collection_files WHERE collection_id = c.id) as file_count
      FROM user_collections c
      WHERE c.user_id = ?
      ORDER BY c.collection_name
    `, [userId]);

    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/library/collections
export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, color, icon, is_smart, smart_query } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const result = await query(`
      INSERT INTO user_collections (user_id, collection_name, description, color)
      VALUES (?, ?, ?, ?)
    `, [userId, name, description, color]);

    return NextResponse.json({
      id: (result as any).insertId,
      name,
      description,
      color,
      icon,
      is_smart: !!is_smart,
      smart_query,
      file_count: 0
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
