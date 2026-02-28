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

// Get user ID from token
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

// GET /api/library/files - Get all files for user
export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || '';
    const fileType = searchParams.get('type');
    const favorite = searchParams.get('favorite');

    let sql = `SELECT * FROM user_files WHERE user_id = ?`;
    const params: any[] = [userId];

    if (search) {
      sql += ` AND (filename LIKE ? OR notes LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (fileType) {
      sql += ` AND file_type = ?`;
      params.push(fileType);
    }

    if (favorite === 'true') {
      sql += ` AND favorite = 1`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const files = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM user_files WHERE user_id = ?`;
    const countParams: any[] = [userId];

    if (search) {
      countSql += ` AND (filename LIKE ? OR notes LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await queryOne<{ total: number }>(countSql, countParams);

    return NextResponse.json({
      files: (files as any[]).map(f => ({
        ...f,
        tags: []
      })),
      total: countResult?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/library/files - Create/sync files
export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { files } = body;

    if (!Array.isArray(files)) {
      return NextResponse.json({ error: 'files must be an array' }, { status: 400 });
    }

    const results = [];
    for (const file of files) {
      // Check if file already exists by path
      const existing = await queryOne<any>(
        'SELECT id FROM user_files WHERE user_id = ? AND file_path = ?',
        [userId, file.file_path]
      );

      if (existing) {
        // Update existing file
        await query(`
          UPDATE user_files SET
            filename = ?, file_type = ?, file_size_bytes = ?,
            duration_seconds = ?, sample_rate = ?, bit_depth = ?,
            bpm = ?, detected_key = ?, sync_hash = ?, updated_at = NOW()
          WHERE id = ?
        `, [
          file.filename, file.file_type || 'sample', file.file_size || null,
          file.duration || null, file.sample_rate || null, file.bit_depth || null,
          file.bpm || null, file.detected_key || null, file.hash || null, existing.id
        ]);
        results.push({ id: existing.id, action: 'updated' });
      } else {
        // Insert new file
        const result = await query(`
          INSERT INTO user_files (
            user_id, file_path, filename, file_type, file_size_bytes,
            duration_seconds, sample_rate, bit_depth, bpm, detected_key, sync_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId, file.file_path, file.filename, file.file_type || 'sample',
          file.file_size || null, file.duration || null, file.sample_rate || null,
          file.bit_depth || null, file.bpm || null, file.detected_key || null,
          file.hash || null
        ]);
        results.push({ id: (result as any).insertId, action: 'created' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Error creating files:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
