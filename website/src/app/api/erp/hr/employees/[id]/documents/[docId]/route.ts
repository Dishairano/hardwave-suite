import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, getClientIP, sanitizeForAudit } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';

// DELETE /api/erp/hr/employees/[id]/documents/[docId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id, docId } = await params;
    const employeeId = parseInt(id);
    const documentId = parseInt(docId);

    // Verify document belongs to this employee
    const existing = await queryOne<any>(`
      SELECT * FROM hr_employee_documents
      WHERE id = ? AND employee_id = ?
    `, [documentId, employeeId]);

    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await query('DELETE FROM hr_employee_documents WHERE id = ?', [documentId]);

    await logERPAction({
      user_id: auth.userId,
      module: 'hr',
      action: 'delete',
      entity_type: 'employee_document',
      entity_id: documentId,
      old_values: sanitizeForAudit(existing),
      ip_address: getClientIP(request),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete document error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
