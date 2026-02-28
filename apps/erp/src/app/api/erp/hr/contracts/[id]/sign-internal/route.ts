import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { getClientIp, getUserAgent } from '@/lib/contract-storage';
import { embedSignatureInPdf, resolveContractPdfPath } from '@/lib/pdf-signer';

// POST /api/erp/hr/contracts/[id]/sign-internal - Internal party signs the contract
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

    const { signature_data } = body;

    if (!signature_data) {
      return NextResponse.json(
        { error: 'Signature data is required' },
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

    if (contract.internal_signed_at) {
      return NextResponse.json(
        { error: 'Contract has already been signed internally' },
        { status: 400 }
      );
    }

    // Validate user has permission to sign
    // User must be the designated internal signer or have HR write permission
    if (contract.internal_signer_id && contract.internal_signer_id !== auth.userId) {
      return NextResponse.json(
        { error: 'You are not authorized to sign this contract' },
        { status: 403 }
      );
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update contract with internal signature
    await query(
      `UPDATE hr_contracts
       SET internal_signer_id = ?,
           internal_signed_at = ?,
           internal_signature_data = ?,
           internal_ip_address = ?,
           status = 'pending_external'
       WHERE id = ?`,
      [auth.userId, now, signature_data, ipAddress, contractId]
    );

    // Embed signature into PDF if positions are configured
    if (contract.document_url) {
      const positions = typeof contract.signature_positions === 'string'
        ? JSON.parse(contract.signature_positions)
        : contract.signature_positions;

      if (positions?.internal_signature || positions?.internal_date) {
        try {
          const pdfPath = resolveContractPdfPath(contract.document_url);
          await embedSignatureInPdf(
            pdfPath,
            signature_data,
            new Date(now).toLocaleString(),
            positions?.internal_signature,
            positions?.internal_date,
          );
        } catch (pdfErr) {
          console.error('Failed to embed signature in PDF:', pdfErr);
          // Continue — signing is still recorded in DB even if PDF embed fails
        }
      }
    }

    // Log the signing action
    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'internal_signed', ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        auth.userId,
        auth.userName,
        auth.userEmail,
        ipAddress,
        userAgent,
        'Internal party signed the contract',
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
      message: 'Contract signed internally. You can now send it to the external party.',
      contract: updatedContract,
    });
  } catch (error: any) {
    console.error('Sign internal error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
