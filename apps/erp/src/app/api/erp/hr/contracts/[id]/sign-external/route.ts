import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { getClientIp, getUserAgent, isTokenExpired } from '@/lib/contract-storage';
import { sendContractCompletionEmail } from '@/lib/email';
import { embedSignatureInPdf, resolveContractPdfPath } from '@/lib/pdf-signer';

// POST /api/erp/hr/contracts/[id]/sign-external - External party signs the contract (public route)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = parseInt(id);
    const body = await request.json();

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    const { signature_data, email, token } = body;

    if (!signature_data || !email || !token) {
      return NextResponse.json(
        { error: 'Signature data, email, and token are required' },
        { status: 400 }
      );
    }

    // Get contract
    const contract = await queryOne<HRContract>(
      `SELECT
        c.*,
        u_internal.email as internal_signer_email,
        u_creator.email as creator_email
      FROM hr_contracts c
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      LEFT JOIN users u_creator ON c.created_by = u_creator.id
      WHERE c.id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Validate token
    if (contract.signing_token !== token) {
      return NextResponse.json({ error: 'Invalid signing token' }, { status: 403 });
    }

    // Check token expiration
    if (isTokenExpired(contract.token_expires_at)) {
      return NextResponse.json({ error: 'Signing link has expired' }, { status: 403 });
    }

    // Validate email matches
    if (contract.external_signer_email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match the designated external signer' },
        { status: 403 }
      );
    }

    // Validate contract state
    if (contract.status !== 'pending_external') {
      if (contract.status === 'completed') {
        return NextResponse.json(
          { error: 'Contract has already been signed' },
          { status: 400 }
        );
      }
      if (contract.status === 'revoked') {
        return NextResponse.json(
          { error: 'Contract has been revoked' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Contract is not ready for external signing' },
        { status: 400 }
      );
    }

    if (!contract.internal_signed_at) {
      return NextResponse.json(
        { error: 'Contract must be signed internally first' },
        { status: 400 }
      );
    }

    if (contract.external_signed_at) {
      return NextResponse.json(
        { error: 'Contract has already been signed externally' },
        { status: 400 }
      );
    }

    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update contract with external signature
    await query(
      `UPDATE hr_contracts
       SET external_signed_at = ?,
           external_signature_data = ?,
           external_ip_address = ?,
           status = 'completed'
       WHERE id = ?`,
      [now, signature_data, ipAddress, contractId]
    );

    // Embed signature into PDF if positions are configured
    if (contract.document_url) {
      const positions = typeof contract.signature_positions === 'string'
        ? JSON.parse(contract.signature_positions)
        : contract.signature_positions;

      if (positions?.external_signature || positions?.external_date) {
        try {
          const pdfPath = resolveContractPdfPath(contract.document_url);
          await embedSignatureInPdf(
            pdfPath,
            signature_data,
            new Date(now).toLocaleString(),
            positions?.external_signature,
            positions?.external_date,
          );
        } catch (pdfErr) {
          console.error('Failed to embed external signature in PDF:', pdfErr);
        }
      }
    }

    // Log the signing action
    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'external_signed', NULL, ?, ?, ?, ?, ?)`,
      [
        contractId,
        contract.external_signer_name,
        email,
        ipAddress,
        userAgent,
        'External party signed the contract',
      ]
    );

    // Build download link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const downloadLink = `${baseUrl}/api/erp/hr/contracts/${contractId}/download?token=${contract.signing_token}`;

    // Send completion emails to both parties
    const recipients: string[] = [];
    if (contract.internal_signer_email) {
      recipients.push(contract.internal_signer_email);
    }
    if (contract.creator_email && contract.creator_email !== contract.internal_signer_email) {
      recipients.push(contract.creator_email);
    }
    if (contract.external_signer_email) {
      recipients.push(contract.external_signer_email);
    }

    if (recipients.length > 0) {
      const emailResult = await sendContractCompletionEmail(
        recipients,
        contract.title,
        downloadLink
      );

      if (!emailResult.success) {
        console.error('Failed to send completion emails:', emailResult.error);
      }
    }

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
      message: 'Contract signed successfully! The document is now fully executed.',
      contract: updatedContract,
    });
  } catch (error: any) {
    console.error('Sign external error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
