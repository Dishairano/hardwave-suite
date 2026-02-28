import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query } from '@/lib/db';
import type { HREmployeeDocument } from '@/lib/erp-types';

// GET /api/erp/hr/employees/[id]/documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const employeeId = parseInt(id);

    const documents = await query<HREmployeeDocument[]>(`
      SELECT d.*,
        CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name
      FROM hr_employee_documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.employee_id = ?
      ORDER BY d.created_at DESC
    `, [employeeId]);

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('Get documents error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/employees/[id]/documents
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();

    const { document_type, title, description, document_url, issue_date, expiry_date, status } = body;

    if (!document_type || !title) {
      return NextResponse.json({ error: 'Document type and title are required' }, { status: 400 });
    }

    const result = await query<any>(`
      INSERT INTO hr_employee_documents
        (employee_id, document_type, title, description, document_url, issue_date, expiry_date, status, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeId,
      document_type,
      title,
      description || null,
      document_url || null,
      issue_date || null,
      expiry_date || null,
      status || 'active',
      auth.userId
    ]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'create',
      entity_type: 'employee_document',
      entity_id: result.insertId,
      new_values: sanitizeForAudit(body),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error: any) {
    console.error('Create document error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
