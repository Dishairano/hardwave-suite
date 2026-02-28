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

// Map file extension to database enum value
const VALID_FILE_TYPES = ['wav', 'mp3', 'flac', 'ogg', 'aiff', 'one_shot', 'loop', 'midi', 'flp', 'other'];

function getFileType(filename: string, providedType?: string): string {
  // Extract extension from filename
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Map common extensions to enum values
  if (['wav', 'mp3', 'flac', 'ogg', 'aiff'].includes(ext)) {
    return ext;
  }
  if (ext === 'mid' || ext === 'midi') {
    return 'midi';
  }
  if (ext === 'flp') {
    return 'flp';
  }

  // If providedType is a valid enum value, use it
  if (providedType && VALID_FILE_TYPES.includes(providedType.toLowerCase())) {
    return providedType.toLowerCase();
  }

  return 'other';
}

// POST /api/library/files/sync - Bulk sync files from desktop app
export async function POST(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { files } = body;

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`Syncing ${files.length} files for user ${userId}`);

    const results: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        // Check if file already exists by path
        const existing = await queryOne<any>(
          'SELECT id FROM user_files WHERE user_id = ? AND file_path = ?',
          [userId, file.file_path]
        );

        const fileType = getFileType(file.filename, file.file_type);

        if (existing) {
          // Update existing file
          await query(`
            UPDATE user_files SET
              filename = ?, file_type = ?, file_size_bytes = ?,
              duration_seconds = ?, sample_rate = ?, bit_depth = ?,
              bpm = ?, detected_key = ?, sync_hash = ?, last_synced_at = NOW()
            WHERE id = ? AND user_id = ?
          `, [
            file.filename,
            fileType,
            file.file_size || null,
            file.duration || null,
            file.sample_rate || null,
            file.bit_depth || null,
            file.bpm || null,
            file.detected_key || null,
            file.hash || null,
            existing.id,
            userId
          ]);

          const updatedFile = await queryOne<any>(
            'SELECT * FROM user_files WHERE id = ?',
            [existing.id]
          );
          results.push(updatedFile);
        } else {
          // Insert new file
          const result = await query(`
            INSERT INTO user_files (
              user_id, file_path, filename, file_type, file_size_bytes,
              duration_seconds, sample_rate, bit_depth, bpm, detected_key,
              sync_hash, last_synced_at, favorite
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), FALSE)
          `, [
            userId,
            file.file_path,
            file.filename,
            fileType,
            file.file_size || null,
            file.duration || null,
            file.sample_rate || null,
            file.bit_depth || null,
            file.bpm || null,
            file.detected_key || null,
            file.hash || null
          ]) as any;

          const newFile = await queryOne<any>(
            'SELECT * FROM user_files WHERE id = ?',
            [result.insertId]
          );
          results.push(newFile);
        }
      } catch (fileError) {
        console.error(`Error syncing file ${file.file_path}:`, fileError);
        errors.push({ file_path: file.file_path, error: String(fileError) });
      }
    }

    console.log(`Sync complete: ${results.length} files synced, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      results,
      errors,
      message: `Synced ${results.length} files`
    });
  } catch (error) {
    console.error('Bulk sync error:', error);
    return NextResponse.json({ error: 'Failed to sync files' }, { status: 500 });
  }
}
