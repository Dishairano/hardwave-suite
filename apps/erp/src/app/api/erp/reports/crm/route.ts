import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, buildDateRangeFilter } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// GET /api/erp/reports/crm - CRM analytics
export async function GET(request: NextRequest) {
  try {
    await requireERPPermission(request, 'crm', 'read');
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

    // Pipeline overview
    const pipeline = await query<any[]>(`
      SELECT
        s.name as stage,
        s.sort_order,
        COUNT(d.id) as deal_count,
        COALESCE(SUM(d.value), 0) as total_value,
        COALESCE(AVG(d.probability), 0) as avg_probability
      FROM crm_pipeline_stages s
      LEFT JOIN crm_deals d ON d.stage_id = s.id AND d.actual_close_date IS NULL
      GROUP BY s.id, s.name, s.sort_order
      ORDER BY s.sort_order
    `);

    // Deals over time
    const dealsParams: any[] = [];
    let dealsSql = `
      SELECT
        DATE_FORMAT(created_at, '${dateFormat}') as period,
        COUNT(*) as new_deals,
        SUM(value) as total_value,
        SUM(CASE WHEN won = TRUE THEN 1 ELSE 0 END) as won_deals,
        SUM(CASE WHEN won = TRUE THEN value ELSE 0 END) as won_value
      FROM crm_deals
      WHERE 1=1
    `;
    dealsSql += buildDateRangeFilter('created_at', startDate, endDate, dealsParams);
    dealsSql += ` GROUP BY period ORDER BY period`;
    const dealsOverTime = await query<any[]>(dealsSql, dealsParams);

    // Lead sources performance
    const leadSources = await query<any[]>(`
      SELECT
        COALESCE(lead_source, 'Unknown') as source,
        COUNT(*) as contact_count,
        SUM(CASE WHEN lead_status = 'qualified' THEN 1 ELSE 0 END) as qualified,
        SUM(CASE WHEN lead_status = 'customer' THEN 1 ELSE 0 END) as converted
      FROM crm_contacts
      GROUP BY lead_source
      ORDER BY contact_count DESC
    `);

    // Win rate by owner
    const winRateByOwner = await query<any[]>(`
      SELECT
        u.display_name as owner,
        COUNT(*) as total_deals,
        SUM(CASE WHEN d.won = TRUE THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN d.won = FALSE AND d.actual_close_date IS NOT NULL THEN 1 ELSE 0 END) as lost,
        ROUND(SUM(CASE WHEN d.won = TRUE THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(CASE WHEN d.actual_close_date IS NOT NULL THEN 1 END), 0), 1) as win_rate
      FROM crm_deals d
      JOIN users u ON d.owner_id = u.id
      WHERE d.actual_close_date IS NOT NULL
      GROUP BY d.owner_id, u.display_name
      ORDER BY win_rate DESC
    `);

    // Contacts by status
    const contactsByStatus = await query<any[]>(`
      SELECT
        lead_status as status,
        COUNT(*) as count
      FROM crm_contacts
      GROUP BY lead_status
      ORDER BY count DESC
    `);

    // Companies by industry
    const companiesByIndustry = await query<any[]>(`
      SELECT
        COALESCE(industry, 'Unknown') as industry,
        COUNT(*) as count,
        COALESCE(SUM(annual_revenue), 0) as total_revenue
      FROM crm_companies
      GROUP BY industry
      ORDER BY count DESC
      LIMIT 10
    `);

    // Activity metrics
    const activityParams: any[] = [];
    let activitySql = `
      SELECT
        activity_type as type,
        COUNT(*) as count
      FROM crm_activities
      WHERE 1=1
    `;
    activitySql += buildDateRangeFilter('activity_date', startDate, endDate, activityParams);
    activitySql += ` GROUP BY activity_type ORDER BY count DESC`;
    const activityMetrics = await query<any[]>(activitySql, activityParams);

    // Average deal cycle time
    const cycleTime = await queryOne<any>(`
      SELECT
        AVG(DATEDIFF(actual_close_date, created_at)) as avg_days,
        MIN(DATEDIFF(actual_close_date, created_at)) as min_days,
        MAX(DATEDIFF(actual_close_date, created_at)) as max_days
      FROM crm_deals
      WHERE actual_close_date IS NOT NULL AND won = TRUE
    `);

    return NextResponse.json({
      period: { start_date: startDate, end_date: endDate, group_by: groupBy },
      pipeline: pipeline.map(p => ({
        ...p,
        total_value: parseFloat(p.total_value || 0),
        avg_probability: parseFloat(p.avg_probability || 0),
      })),
      deals_over_time: dealsOverTime.map(d => ({
        ...d,
        total_value: parseFloat(d.total_value || 0),
        won_value: parseFloat(d.won_value || 0),
      })),
      lead_sources: leadSources,
      win_rate_by_owner: winRateByOwner.map(w => ({
        ...w,
        win_rate: parseFloat(w.win_rate || 0),
      })),
      contacts_by_status: contactsByStatus,
      companies_by_industry: companiesByIndustry.map(c => ({
        ...c,
        total_revenue: parseFloat(c.total_revenue || 0),
      })),
      activity_metrics: activityMetrics,
      deal_cycle: {
        avg_days: parseFloat(cycleTime?.avg_days || 0),
        min_days: cycleTime?.min_days || 0,
        max_days: cycleTime?.max_days || 0,
      },
    });
  } catch (error: any) {
    console.error('Get CRM reports error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
