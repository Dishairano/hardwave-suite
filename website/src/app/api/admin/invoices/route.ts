import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);

    if (!auth || !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE i.status = ?';
      params.push(status);
    }

    const invoices = await query<any[]>(`
      SELECT
        i.*,
        u.email,
        u.display_name
      FROM invoices i
      JOIN users u ON u.id = i.user_id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const totalResult = await queryOne<any>(`
      SELECT COUNT(*) as count FROM invoices i ${whereClause}
    `, params);

    // Get summary stats
    const summary = await queryOne<any>(`
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END) as paid_total,
        SUM(CASE WHEN status = 'open' THEN amount_cents ELSE 0 END) as open_total
      FROM invoices
    `);

    return NextResponse.json({
      success: true,
      invoices: invoices.map((i: any) => ({
        id: i.id,
        userId: i.user_id,
        userEmail: i.email,
        userName: i.display_name,
        invoiceNumber: i.invoice_number,
        stripeInvoiceId: i.stripe_invoice_id,
        status: i.status,
        amount: i.amount_cents / 100,
        currency: i.currency,
        description: i.description,
        pdfUrl: i.invoice_pdf_url,
        paidAt: i.paid_at,
        periodStart: i.period_start,
        periodEnd: i.period_end,
        createdAt: i.created_at,
      })),
      summary: {
        totalInvoices: summary?.total_count || 0,
        paidTotal: (summary?.paid_total || 0) / 100,
        openTotal: (summary?.open_total || 0) / 100,
      },
      pagination: {
        page,
        limit,
        total: totalResult?.count || 0,
        totalPages: Math.ceil((totalResult?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Admin invoices error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
