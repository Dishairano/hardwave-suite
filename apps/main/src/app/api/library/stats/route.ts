import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
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

// GET /api/library/stats
export async function GET(request: NextRequest) {
  const userId = getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM user_files WHERE user_id = ?) as totalFiles,
        (SELECT COUNT(*) FROM user_tags WHERE user_id = ?) as totalTags,
        (SELECT COUNT(*) FROM user_collections WHERE user_id = ?) as totalCollections,
        (SELECT COUNT(*) FROM user_files WHERE user_id = ? AND favorite = 1) as totalFavorites
    `, [userId, userId, userId, userId]);

    return NextResponse.json({
      totalFiles: stats?.totalFiles || 0,
      totalTags: stats?.totalTags || 0,
      totalCollections: stats?.totalCollections || 0,
      totalFavorites: stats?.totalFavorites || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
