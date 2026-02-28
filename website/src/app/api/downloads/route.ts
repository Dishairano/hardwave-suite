import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has active subscription
    const subscription = await queryOne<any>(
      `SELECT id, status FROM subscriptions
       WHERE user_id = ? AND status IN ('active', 'trialing')
       LIMIT 1`,
      [auth.userId]
    );

    if (!subscription) {
      return NextResponse.json({
        success: true,
        hasAccess: false,
        products: [],
      });
    }

    // Get available products
    const products = await query<any[]>(
      `SELECT
        id,
        name,
        slug,
        description,
        current_version,
        download_url_windows,
        download_url_mac,
        download_url_linux,
        file_size_mb,
        changelog
       FROM products
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );

    // Get user's download history
    const downloads = await query<any[]>(
      `SELECT product, version, platform, downloaded_at
       FROM downloads
       WHERE user_id = ?
       ORDER BY downloaded_at DESC
       LIMIT 10`,
      [auth.userId]
    );

    return NextResponse.json({
      success: true,
      hasAccess: true,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        version: p.current_version,
        downloads: {
          windows: p.download_url_windows,
          mac: p.download_url_mac,
          linux: p.download_url_linux,
        },
        fileSize: p.file_size_mb,
        changelog: p.changelog,
      })),
      recentDownloads: downloads.map((d: any) => ({
        product: d.product,
        version: d.version,
        platform: d.platform,
        downloadedAt: d.downloaded_at,
      })),
    });
  } catch (error) {
    console.error('Downloads fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch downloads' },
      { status: 500 }
    );
  }
}

// Record a download
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { productSlug, platform } = await request.json();

    // Check subscription
    const subscription = await queryOne<any>(
      `SELECT s.id, l.id as license_id FROM subscriptions s
       LEFT JOIN licenses l ON l.subscription_id = s.id
       WHERE s.user_id = ? AND s.status IN ('active', 'trialing')
       LIMIT 1`,
      [auth.userId]
    );

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Active subscription required' },
        { status: 403 }
      );
    }

    // Get product
    const product = await queryOne<any>(
      'SELECT id, current_version FROM products WHERE slug = ? AND is_active = TRUE',
      [productSlug]
    );

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Get IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Record download
    await query(
      `INSERT INTO downloads (user_id, license_id, product, version, platform, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [auth.userId, subscription.license_id, productSlug, product.current_version, platform, ip]
    );

    return NextResponse.json({
      success: true,
      message: 'Download recorded',
    });
  } catch (error) {
    console.error('Download record error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record download' },
      { status: 500 }
    );
  }
}
