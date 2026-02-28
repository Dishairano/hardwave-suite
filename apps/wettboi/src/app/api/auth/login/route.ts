import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await queryOne<any>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Check if user is admin (from admins table OR users table)
    const adminRecord = await queryOne<any>(
      'SELECT role FROM admins WHERE user_id = ?',
      [user.id]
    );
    const isAdmin = !!adminRecord || !!user.is_admin || user.role === 'admin';

    // Get subscription status (gracefully handle if table/columns don't exist)
    let subscription: any = null;
    try {
      subscription = await queryOne<any>(
        'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [user.id]
      );
    } catch (subError) {
      console.warn('Could not fetch subscription:', subError);
      // Continue without subscription data
    }

    // Update last login
    await query(
      'UPDATE users SET last_login_at = NOW(), last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin,
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isAdmin,
      },
      subscription: subscription ? {
        id: subscription.id,
        planId: subscription.plan_id || subscription.planId || null,
        status: subscription.status || 'active',
        currentPeriodEnd: subscription.current_period_end || subscription.currentPeriodEnd || null,
      } : null,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
