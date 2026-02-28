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

// Default tags for new users
const defaultTags = [
  { name: 'Hardstyle', category: 'genre', color: '#FF00AA' },
  { name: 'Rawstyle', category: 'genre', color: '#FF0044' },
  { name: 'Hardcore', category: 'genre', color: '#FF3366' },
  { name: 'Uptempo', category: 'genre', color: '#AA00FF' },
  { name: 'Euphoric', category: 'genre', color: '#00D4FF' },
  { name: 'Kick', category: 'instrument', color: '#FF4466' },
  { name: 'Lead', category: 'instrument', color: '#00FFDD' },
  { name: 'Screech', category: 'instrument', color: '#FF8833' },
  { name: 'Atmosphere', category: 'instrument', color: '#0088FF' },
  { name: 'Vocal', category: 'instrument', color: '#FF00CC' },
  { name: 'FX', category: 'instrument', color: '#00FF88' },
  { name: 'High Energy', category: 'energy', color: '#FF0055' },
  { name: 'Medium Energy', category: 'energy', color: '#FFAA00' },
  { name: 'Low Energy', category: 'energy', color: '#00FF88' },
];

// GET /api/library/tags
export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user has any tags
    const existingTags = await query(
      'SELECT id, user_id, tag_name as name, category, color, created_at FROM user_tags WHERE user_id = ? ORDER BY category, tag_name',
      [userId]
    );

    // If no tags, create default ones
    if ((existingTags as any[]).length === 0) {
      for (const tag of defaultTags) {
        await query(
          'INSERT INTO user_tags (user_id, tag_name, category, color) VALUES (?, ?, ?, ?)',
          [userId, tag.name, tag.category, tag.color]
        );
      }
      // Fetch again
      const newTags = await query(
        'SELECT id, user_id, tag_name as name, category, color, created_at FROM user_tags WHERE user_id = ? ORDER BY category, tag_name',
        [userId]
      );
      return NextResponse.json({ tags: newTags });
    }

    return NextResponse.json({ tags: existingTags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/library/tags
export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, category, color } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if tag already exists
    const existing = await queryOne<any>(
      'SELECT id FROM user_tags WHERE user_id = ? AND tag_name = ?',
      [userId, name]
    );

    if (existing) {
      return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
    }

    const result = await query(
      'INSERT INTO user_tags (user_id, tag_name, category, color) VALUES (?, ?, ?, ?)',
      [userId, name, category || 'custom', color || '#888888']
    );

    return NextResponse.json({
      id: (result as any).insertId,
      name,
      category: category || 'custom',
      color: color || '#888888'
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/library/tags (batch delete by IDs in body)
export async function DELETE(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
    }

    await query('DELETE FROM user_tags WHERE id = ? AND user_id = ?', [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
