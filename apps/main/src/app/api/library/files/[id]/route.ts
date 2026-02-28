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

// GET /api/library/files/[id]
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
    const file = await queryOne<any>(
      'SELECT * FROM user_files WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get tags
    const tags = await query(
      `SELECT t.* FROM user_tags t
       JOIN user_file_tags ft ON t.id = ft.tag_id
       WHERE ft.file_id = ?`,
      [id]
    );

    return NextResponse.json({ ...file, tags });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/library/files/[id]
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
    const file = await queryOne<any>(
      'SELECT id FROM user_files WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ['rating', 'is_favorite', 'notes', 'color_code', 'bpm', 'detected_key'];
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
      await query(`UPDATE user_files SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Handle tags update
    if (body.tagIds !== undefined) {
      await query('DELETE FROM user_file_tags WHERE file_id = ?', [id]);
      for (const tagId of body.tagIds) {
        await query('INSERT INTO user_file_tags (file_id, tag_id) VALUES (?, ?)', [id, tagId]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/library/files/[id]
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
      'DELETE FROM user_files WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
