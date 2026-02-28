import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { getClientIp, getUserAgent } from '@/lib/contract-storage';
import { sendContractRevocationEmail } from '@/lib/email';

// POST /api/erp/hr/contracts/[id]/revoke - Revoke a contract
export async function POST(
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

    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Revocation reason is required' },
        { status: 400 }
      );
    }

    // Get contract
    const contract = await queryOne<HRContract>(
      `SELECT * FROM hr_contracts WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Validate contract state
    if (contract.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot revoke a completed contract' },
        { status: 400 }
      );
    }

    if (contract.status === 'revoked') {
      return NextResponse.json(
        { error: 'Contract is already revoked' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update contract
    await query(
      `UPDATE hr_contracts
       SET status = 'revoked',
           revoked_at = ?,
           revoked_by = ?,
           revoke_reason = ?
       WHERE id = ?`,
      [now, auth.userId, reason, contractId]
    );

    // Log the revocation
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'revoked', ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        auth.userId,
        auth.userName,
        auth.userEmail,
        ipAddress,
        userAgent,
        `Contract revoked. Reason: ${reason}`,
      ]
    );

    await logERPAction({
      user_id: auth.userId,
      action: 'update',
      module: 'hr',
      entity_type: 'contract',
      entity_id: contractId,
      ip_address: ipAddress,
    });

    // Send revocation email to external party if they were involved
    if (contract.external_signer_email && contract.sent_to_external_at) {
      const emailResult = await sendContractRevocationEmail(
        contract.external_signer_email,
        contract.title,
        reason
      );

      if (!emailResult.success) {
        console.error('Failed to send revocation email:', emailResult.error);
      }
    }

    // Fetch and return updated contract
    const updatedContract = await queryOne<HRContract>(
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

    return NextResponse.json({
      success: true,
      message: 'Contract revoked successfully',
      contract: updatedContract,
    });
  } catch (error: any) {
    console.error('Revoke contract error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
