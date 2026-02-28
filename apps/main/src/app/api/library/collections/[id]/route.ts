import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import jwt from 'jsonwebtoken';

function getUserId(request: NextRequest): number | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key') as any;
    return decoded.userId;
  } catch {
    return null;
  }
}

// GET /api/library/collections/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const collection = await queryOne<any>(
      'SELECT * FROM user_collections WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    // Get files in collection
    const files = await query(`
      SELECT f.* FROM user_files f
      JOIN user_collection_files cf ON f.id = cf.file_id
      WHERE cf.collection_id = ?
      ORDER BY cf.sort_order, cf.added_at
    `, [id]);

    return NextResponse.json({ ...collection, files });
  } catch (error) {
    console.error('Error fetching collection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/library/collections/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const collection = await queryOne<any>(
      'SELECT id FROM user_collections WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    const body = await request.json();

    // Handle adding/removing files
    if (body.addFileIds) {
      for (const fileId of body.addFileIds) {
        await query(
          'INSERT IGNORE INTO user_collection_files (collection_id, file_id) VALUES (?, ?)',
          [id, fileId]
        );
      }
    }

    if (body.removeFileIds) {
      for (const fileId of body.removeFileIds) {
        await query(
          'DELETE FROM user_collection_files WHERE collection_id = ? AND file_id = ?',
          [id, fileId]
        );
      }
    }

    // Handle other updates
    const allowedFields = ['name', 'description', 'color', 'icon'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length > 0) {
      values.push(id);
      await query(`UPDATE user_collections SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating collection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/library/collections/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await query(
      'DELETE FROM user_collections WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting collection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
