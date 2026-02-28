import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { InvSupplier } from '@/lib/erp-types';

// GET /api/erp/inventory/suppliers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { id } = await params;
    const supplierId = parseInt(id);

    const supplier = await queryOne<InvSupplier>(`
      SELECT * FROM inv_suppliers WHERE id = ?
    `, [supplierId]);

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Get products from this supplier
    const products = await query<any[]>(`
      SELECT id, sku, name, cost_price, currency
      FROM inv_products
      WHERE default_supplier_id = ?
      ORDER BY name
    `, [supplierId]);

    // Get recent purchase orders
    const purchaseOrders = await query<any[]>(`
      SELECT po.*, u.display_name as created_by_name
      FROM inv_purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.supplier_id = ?
      ORDER BY po.created_at DESC
      LIMIT 10
    `, [supplierId]);

    return NextResponse.json({ supplier, products, purchaseOrders });
  } catch (error: any) {
    console.error('Get supplier error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/erp/inventory/suppliers/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'write');
    const { id } = await params;
    const supplierId = parseInt(id);
    const body = await request.json();

    const existing = await queryOne<InvSupplier>('SELECT * FROM inv_suppliers WHERE id = ?', [supplierId]);
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const allowedFields = [
      'code', 'name', 'contact_name', 'email', 'phone', 'website',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country',
      'payment_terms', 'currency', 'tax_id', 'notes', 'is_active'
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(supplierId);
    await query(`UPDATE inv_suppliers SET ${updates.join(', ')} WHERE id = ?`, values);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'update',
      entity_type: 'supplier',
      entity_id: supplierId,
      old_values: sanitizeForAudit(existing as any),
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    const updated = await queryOne<InvSupplier>('SELECT * FROM inv_suppliers WHERE id = ?', [supplierId]);
    return NextResponse.json({ success: true, supplier: updated });
  } catch (error: any) {
    console.error('Update supplier error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/inventory/suppliers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'inventory', 'delete');
    const { id } = await params;
    const supplierId = parseInt(id);

    const existing = await queryOne<InvSupplier>('SELECT * FROM inv_suppliers WHERE id = ?', [supplierId]);
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Check for products using this supplier
    const products = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM inv_products WHERE default_supplier_id = ?', [supplierId]);
    if (products && products.count > 0) {
      return NextResponse.json({ error: 'Cannot delete supplier with linked products' }, { status: 400 });
    }

    // Check for open purchase orders
    const openPOs = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM inv_purchase_orders
      WHERE supplier_id = ? AND status NOT IN ('received', 'cancelled')
    `, [supplierId]);
    if (openPOs && openPOs.count > 0) {
      return NextResponse.json({ error: 'Cannot delete supplier with open purchase orders' }, { status: 400 });
    }

    await query('DELETE FROM inv_suppliers WHERE id = ?', [supplierId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'inventory',
      action: 'delete',
      entity_type: 'supplier',
      entity_id: supplierId,
      old_values: sanitizeForAudit(existing as any),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete supplier error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
