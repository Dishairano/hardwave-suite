import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const orders = await query<any[]>(
      `SELECT
        id,
        invoice_number,
        status,
        amount_cents,
        currency,
        description,
        invoice_pdf_url,
        hosted_invoice_url,
        paid_at,
        created_at
       FROM invoices
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [auth.userId]
    );

    return NextResponse.json({
      success: true,
      orders: orders.map((inv: any) => ({
        id: inv.id,
        number: inv.invoice_number,
        status: inv.status,
        amount: inv.amount_cents / 100,
        currency: inv.currency.toUpperCase(),
        description: inv.description || 'Hardwave Subscription',
        pdfUrl: inv.invoice_pdf_url,
        hostedUrl: inv.hosted_invoice_url,
        paidAt: inv.paid_at,
        createdAt: inv.created_at,
      })),
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
