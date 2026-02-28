import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports/inventory - Inventory analytics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'inventory', 'read');
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const groupBy = searchParams.get('group_by') || 'month';

    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-%u',
      month: '%Y-%m',
      year: '%Y',
    }[groupBy] || '%Y-%m';

    // Inventory overview
    const overview = await queryOne<any>(`
      SELECT
        (SELECT COUNT(*) FROM inv_products WHERE is_active = TRUE) as active_products,
        (SELECT COUNT(*) FROM inv_products WHERE is_active = FALSE) as inactive_products,
        (SELECT COUNT(*) FROM inv_categories) as categories,
        (SELECT COUNT(*) FROM inv_suppliers WHERE is_active = TRUE) as suppliers,
        (SELECT COALESCE(SUM(s.quantity * p.cost_price), 0) FROM inv_stock s JOIN inv_products p ON s.product_id = p.id) as total_value
    `);

    // Stock by category
    const byCategory = await query<any[]>(`
      SELECT
        c.name as category,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        COALESCE(SUM(s.quantity * p.cost_price), 0) as total_value
      FROM inv_categories c
      LEFT JOIN inv_products p ON p.category_id = c.id AND p.is_active = TRUE
      LEFT JOIN inv_stock s ON s.product_id = p.id
      GROUP BY c.id, c.name
      ORDER BY total_value DESC
    `);

    // Low stock items
    const lowStock = await query<any[]>(`
      SELECT
        p.sku,
        p.name,
        COALESCE(SUM(s.quantity), 0) as current_stock,
        p.reorder_point,
        p.reorder_quantity,
        sup.name as supplier_name
      FROM inv_products p
      LEFT JOIN inv_stock s ON s.product_id = p.id
      LEFT JOIN inv_suppliers sup ON p.default_supplier_id = sup.id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.sku, p.name, p.reorder_point, p.reorder_quantity, sup.name
      HAVING current_stock <= p.reorder_point
      ORDER BY current_stock ASC
      LIMIT 20
    `);

    // Stock movements over time
    const movementParams: any[] = [];
    let movementSql = `
      SELECT
        DATE_FORMAT(created_at, '${dateFormat}') as period,
        movement_type as type,
        SUM(ABS(quantity)) as total_quantity
      FROM inv_stock_movements
      WHERE 1=1
    `;
    movementSql += buildDateRangeFilter('created_at', startDate, endDate, movementParams);
    movementSql += ` GROUP BY period, movement_type ORDER BY period`;
    const stockMovements = await query<any[]>(movementSql, movementParams);

    // Top selling products (based on outgoing movements)
    const topSellingParams: any[] = [];
    let topSellingSql = `
      SELECT
        p.sku,
        p.name,
        SUM(ABS(sm.quantity)) as total_sold,
        SUM(ABS(sm.quantity) * p.selling_price) as revenue
      FROM inv_stock_movements sm
      JOIN inv_products p ON sm.product_id = p.id
      WHERE sm.movement_type IN ('sale', 'out')
    `;
    topSellingSql += buildDateRangeFilter('sm.created_at', startDate, endDate, topSellingParams);
    topSellingSql += ` GROUP BY p.id, p.sku, p.name ORDER BY total_sold DESC LIMIT 10`;
    const topSelling = await query<any[]>(topSellingSql, topSellingParams);

    // Slow moving products (no movement in last 90 days)
    const slowMoving = await query<any[]>(`
      SELECT
        p.sku,
        p.name,
        COALESCE(SUM(s.quantity), 0) as current_stock,
        COALESCE(SUM(s.quantity * p.cost_price), 0) as stock_value,
        (SELECT MAX(created_at) FROM inv_stock_movements WHERE product_id = p.id) as last_movement
      FROM inv_products p
      LEFT JOIN inv_stock s ON s.product_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.sku, p.name
      HAVING current_stock > 0 AND (last_movement IS NULL OR last_movement < DATE_SUB(CURDATE(), INTERVAL 90 DAY))
      ORDER BY stock_value DESC
      LIMIT 20
    `);

    // Supplier performance
    const supplierParams: any[] = [];
    let supplierSql = `
      SELECT
        s.name as supplier,
        COUNT(DISTINCT po.id) as order_count,
        AVG(DATEDIFF(po.received_date, po.order_date)) as avg_lead_time,
        SUM(po.total_amount) as total_spent
      FROM inv_suppliers s
      LEFT JOIN inv_purchase_orders po ON po.supplier_id = s.id AND po.status = 'received'
    `;
    if (startDate || endDate) {
      supplierSql += ' WHERE 1=1';
      supplierSql += buildDateRangeFilter('po.order_date', startDate, endDate, supplierParams);
    }
    supplierSql += ` GROUP BY s.id, s.name ORDER BY total_spent DESC`;
    const supplierPerformance = await query<any[]>(supplierSql, supplierParams);

    // Stock valuation by location
    const byLocation = await query<any[]>(`
      SELECT
        l.name as location,
        COUNT(DISTINCT s.product_id) as product_count,
        SUM(s.quantity) as total_quantity,
        SUM(s.quantity * p.cost_price) as total_value
      FROM inv_locations l
      LEFT JOIN inv_stock s ON s.location_id = l.id
      LEFT JOIN inv_products p ON s.product_id = p.id
      WHERE l.is_active = TRUE
      GROUP BY l.id, l.name
      ORDER BY total_value DESC
    `);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate, group_by: groupBy },
      overview: {
        ...overview,
        total_value: parseFloat(overview?.total_value || 0),
      },
      by_category: byCategory.map(c => ({
        ...c,
        total_value: parseFloat(c.total_value || 0),
      })),
      low_stock: lowStock,
      stock_movements: stockMovements,
      top_selling: topSelling.map(t => ({
        ...t,
        revenue: parseFloat(t.revenue || 0),
      })),
      slow_moving: slowMoving.map(s => ({
        ...s,
        stock_value: parseFloat(s.stock_value || 0),
      })),
      supplier_performance: supplierPerformance.map(s => ({
        ...s,
        avg_lead_time: parseFloat(s.avg_lead_time || 0),
        total_spent: parseFloat(s.total_spent || 0),
      })),
      by_location: byLocation.map(l => ({
        ...l,
        total_value: parseFloat(l.total_value || 0),
      })),
    });
  } catch (error: any) {
    console.error('Get inventory reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
