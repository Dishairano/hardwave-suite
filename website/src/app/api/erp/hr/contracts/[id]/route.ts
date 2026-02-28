import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract, HRContractAuditLog } from '@/lib/erp-types';
import { getClientIp, getUserAgent } from '@/lib/contract-storage';

// GET /api/erp/hr/contracts/[id] - Get contract details with audit log
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'read');
    const { id } = await params;
    const contractId = parseInt(id);

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    // Get contract details
    const contract = await queryOne<HRContract>(
      `SELECT
        c.*,
        COALESCE(u_creator.display_name, u_creator.email) as created_by_name,
        COALESCE(u_internal.display_name, u_internal.email) as internal_signer_name,
        u_internal.email as internal_signer_email,
        COALESCE(u_revoker.display_name, u_revoker.email) as revoked_by_name
      FROM hr_contracts c
      LEFT JOIN users u_creator ON c.created_by = u_creator.id
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      LEFT JOIN users u_revoker ON c.revoked_by = u_revoker.id
      WHERE c.id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Get audit log
    const auditLog = await query<HRContractAuditLog[]>(
      `SELECT * FROM hr_contract_audit_log
       WHERE contract_id = ?
       ORDER BY created_at DESC`,
      [contractId]
    );

    // Log view action
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent
      ) VALUES (?, 'viewed', ?, ?, ?, ?, ?)`,
      [contractId, auth.userId, auth.userName, auth.userEmail, ipAddress, userAgent]
    );

    return NextResponse.json({
      ...contract,
      audit_log: auditLog,
    });
  } catch (error: any) {
    console.error('Get contract error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/erp/hr/contracts/[id] - Update contract metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const contractId = parseInt(id);
    const body = await request.json();

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    // Check if contract exists
    const existingContract = await queryOne<HRContract>(
      `SELECT * FROM hr_contracts WHERE id = ?`,
      [contractId]
    );

    if (!existingContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Only allow updating certain fields
    const {
      title,
      description,
      document_type,
      external_signer_name,
      external_signer_email,
      internal_signer_id,
      signature_positions,
    } = body;

    // Don't allow updates if contract is already completed or revoked
    if (existingContract.status === 'completed' || existingContract.status === 'revoked') {
      return NextResponse.json(
        { error: 'Cannot update a completed or revoked contract' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (document_type !== undefined) {
      updates.push('document_type = ?');
      values.push(document_type);
    }
    if (external_signer_name !== undefined) {
      updates.push('external_signer_name = ?');
      values.push(external_signer_name);
    }
    if (external_signer_email !== undefined) {
      updates.push('external_signer_email = ?');
      values.push(external_signer_email);
    }
    if (internal_signer_id !== undefined) {
      updates.push('internal_signer_id = ?');
      values.push(internal_signer_id);
    }
    if (signature_positions !== undefined) {
      updates.push('signature_positions = ?');
      values.push(JSON.stringify(signature_positions));
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    values.push(contractId);

    await query(
      `UPDATE hr_contracts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Log the action
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await logERPAction({
      user_id: auth.userId,
      action: 'update',
      module: 'hr',
      entity_type: 'contract',
      entity_id: contractId,
      ip_address: ipAddress,
    });

    // Fetch and return updated contract
    const updatedContract = await queryOne<HRContract>(
      `SELECT
        c.*,
        COALESCE(u_creator.display_name, u_creator.email) as created_by_name,
        COALESCE(u_internal.display_name, u_internal.email) as internal_signer_name,
        u_internal.email as internal_signer_email
      FROM hr_contracts c
      LEFT JOIN users u_creator ON c.created_by = u_creator.id
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      WHERE c.id = ?`,
      [contractId]
    );

    return NextResponse.json(updatedContract);
  } catch (error: any) {
    console.error('Update contract error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/erp/hr/contracts/[id] - Delete contract (only if draft)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'delete');
    const { id } = await params;
    const contractId = parseInt(id);

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    // Check if contract exists and is draft
    const contract = await queryOne<HRContract>(
      `SELECT * FROM hr_contracts WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft contracts can be deleted' },
        { status: 400 }
      );
    }

    // Delete contract (audit log will cascade delete)
    await query(`DELETE FROM hr_contracts WHERE id = ?`, [contractId]);

    const ipAddress = getClientIp(request);

    await logERPAction({
      user_id: auth.userId,
      action: 'delete',
      module: 'hr',
      entity_type: 'contract',
      entity_id: contractId,
      ip_address: ipAddress,
    });

    return NextResponse.json({ success: true, message: 'Contract deleted successfully' });
  } catch (error: any) {
    console.error('Delete contract error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
