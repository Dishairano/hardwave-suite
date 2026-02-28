import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// This endpoint is called by desktop apps to verify license
export async function POST(request: NextRequest) {
  try {
    const { licenseKey, machineId, product } = await request.json();

    if (!licenseKey) {
      return NextResponse.json(
        { valid: false, error: 'License key required' },
        { status: 400 }
      );
    }

    // Get license with subscription info
    const license = await queryOne<any>(
      `SELECT
        l.*,
        s.status as subscription_status,
        s.current_period_end,
        u.email,
        u.display_name
       FROM licenses l
       JOIN subscriptions s ON l.subscription_id = s.id
       JOIN users u ON l.user_id = u.id
       WHERE l.license_key = ?`,
      [licenseKey]
    );

    if (!license) {
      return NextResponse.json({
        valid: false,
        error: 'Invalid license key',
      });
    }

    // Check if license is active
    if (license.status !== 'active') {
      return NextResponse.json({
        valid: false,
        error: `License is ${license.status}`,
      });
    }

    // Check if subscription is active
    if (license.subscription_status !== 'active' && license.subscription_status !== 'trialing') {
      return NextResponse.json({
        valid: false,
        error: 'Subscription is not active',
      });
    }

    // Check product access
    if (license.product !== 'all' && license.product !== product) {
      return NextResponse.json({
        valid: false,
        error: 'License not valid for this product',
      });
    }

    // Handle machine binding (optional)
    if (machineId) {
      if (!license.machine_id) {
        // First activation - bind to this machine
        await query(
          'UPDATE licenses SET machine_id = ?, activations = 1, last_verified_at = NOW() WHERE id = ?',
          [machineId, license.id]
        );
      } else if (license.machine_id !== machineId) {
        // Different machine
        if (license.activations >= license.max_activations) {
          return NextResponse.json({
            valid: false,
            error: 'Maximum activations reached. Deactivate another device first.',
            activations: license.activations,
            maxActivations: license.max_activations,
          });
        }
        // Allow on new machine, increment activations
        await query(
          'UPDATE licenses SET activations = activations + 1, last_verified_at = NOW() WHERE id = ?',
          [license.id]
        );
      } else {
        // Same machine - just update last verified
        await query(
          'UPDATE licenses SET last_verified_at = NOW() WHERE id = ?',
          [license.id]
        );
      }
    }

    return NextResponse.json({
      valid: true,
      license: {
        product: license.product,
        expiresAt: license.current_period_end,
        userName: license.display_name || license.email,
      },
    });
  } catch (error) {
    console.error('License verification error:', error);
    return NextResponse.json(
      { valid: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
