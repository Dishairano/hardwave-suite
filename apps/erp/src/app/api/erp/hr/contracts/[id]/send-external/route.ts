import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { getClientIp, getUserAgent } from '@/lib/contract-storage';
import { sendContractSigningInvitation } from '@/lib/email';

// POST /api/erp/hr/contracts/[id]/send-external - Send contract to external party for signing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const { id } = await params;
    const contractId = parseInt(id);

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    // Get contract
    const contract = await queryOne<HRContract>(
      `SELECT
        c.*,
        u_internal.email as internal_signer_email,
        u_internal.id as internal_signer_user_id
      FROM hr_contracts c
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      WHERE c.id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Validate contract state
    if (!contract.internal_signed_at) {
      return NextResponse.json(
        { error: 'Contract must be signed internally before sending to external party' },
        { status: 400 }
      );
    }

    if (contract.status === 'completed') {
      return NextResponse.json(
        { error: 'Contract is already completed' },
        { status: 400 }
      );
    }

    if (contract.status === 'revoked') {
      return NextResponse.json(
        { error: 'Contract has been revoked' },
        { status: 400 }
      );
    }

    if (!contract.external_signer_email) {
      return NextResponse.json(
        { error: 'External signer email is required' },
        { status: 400 }
      );
    }

    if (!contract.signing_token) {
      return NextResponse.json(
        { error: 'Signing token is missing' },
        { status: 500 }
      );
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update contract status
    await query(
      `UPDATE hr_contracts
       SET sent_to_external_at = ?,
           status = 'pending_external'
       WHERE id = ?`,
      [now, contractId]
    );

    // Build signing link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const signingLink = `${baseUrl}/contracts/sign/${contract.signing_token}`;

    // Send email invitation
    const emailResult = await sendContractSigningInvitation(
      contract.external_signer_email,
      contract.external_signer_name || 'Recipient',
      contract.title,
      signingLink,
      contract.internal_signer_email || 'Hardwave Studios'
    );

    if (!emailResult.success) {
      // Log the error but don't fail the request
      console.error('Failed to send signing invitation email:', emailResult.error);
    }

    // Log the action
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'sent_to_external', ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        auth.userId,
        auth.userName,
        auth.userEmail,
        ipAddress,
        userAgent,
        `Contract sent to ${contract.external_signer_email}`,
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

    return NextResponse.json({
      success: true,
      message: `Contract sent to ${contract.external_signer_email}`,
      contract: updatedContract,
      email_sent: emailResult.success,
    });
  } catch (error: any) {
    console.error('Send external error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
