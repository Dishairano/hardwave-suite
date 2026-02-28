import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query, queryOne } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await queryOne<{ id: number; email: string }>(
      'SELECT id, email FROM users WHERE email = ?',
      [email]
    );

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token in database
    await query(
      `UPDATE users
       SET reset_token = ?, reset_token_expires = ?
       WHERE id = ?`,
      [resetTokenHash, expiresAt, user.id]
    );

    // Build reset link
    const baseUrl = process.env.NEXTAUTH_URL || 'https://hardwavestudios.com';
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send email
    const emailResult = await sendPasswordResetEmail(email, resetLink);

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Still return success to prevent enumeration, but log the error
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
