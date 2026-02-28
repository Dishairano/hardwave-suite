import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { queryOne } from './db';

interface JwtPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
}

export async function verifyAuth(request: NextRequest): Promise<JwtPayload | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_secret_key'
    ) as JwtPayload;

    return decoded;
  } catch {
    return null;
  }
}

export async function getUserFromToken(request: NextRequest) {
  const payload = await verifyAuth(request);

  if (!payload) {
    return null;
  }

  const user = await queryOne<any>(
    'SELECT id, email, display_name, avatar_url, is_active FROM users WHERE id = ?',
    [payload.userId]
  );

  if (!user || !user.is_active) {
    return null;
  }

  return {
    ...user,
    isAdmin: payload.isAdmin,
  };
}

export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = 4;
  const segmentLength = 4;
  const parts: string[] = [];

  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(segment);
  }

  return parts.join('-');
}

/**
 * Check if a user has ERP access (admin or assigned ERP roles)
 */
export async function hasERPAccess(userId: number): Promise<boolean> {
  const { hasERPAccess: checkAccess } = await import('./erp');
  return checkAccess(userId);
}
