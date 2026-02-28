import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, password, display_name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await queryOne<any>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await query<any>(
      `INSERT INTO users (email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [email, password_hash, display_name || null]
    );

    const userId = (result as any).insertId;

    // Generate JWT token
    const token = jwt.sign(
      {
        userId,
        email,
        isAdmin: false,
      },
      process.env.JWT_SECRET || 'your_secret_key',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        display_name: display_name || null,
        isAdmin: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
