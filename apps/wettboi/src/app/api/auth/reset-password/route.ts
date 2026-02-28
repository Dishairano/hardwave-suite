import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, token, password } = await request.json();

    if (!email || !token || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, token, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await queryOne<{
      id: number;
      email: string;
      reset_token: string;
      reset_token_expires: Date;
    }>(
      `SELECT id, email, reset_token, reset_token_expires
       FROM users
       WHERE email = ? AND reset_token = ? AND reset_token_expires > NOW()`,
      [email, tokenHash]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await query(
      `UPDATE users
       SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL
       WHERE id = ?`,
      [passwordHash, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
