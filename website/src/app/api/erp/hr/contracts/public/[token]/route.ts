import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { isTokenExpired } from '@/lib/contract-storage';

// GET /api/erp/hr/contracts/public/[token] - Get contract details by signing token (public route)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Get contract by signing token
    const contract = await queryOne<HRContract>(
      `SELECT
        c.id,
        c.title,
        c.document_type,
        c.description,
        c.document_url,
        c.status,
        c.external_signer_name,
        c.external_signer_email,
        c.internal_signed_at,
        c.external_signed_at,
        c.sent_to_external_at,
        c.token_expires_at,
        c.revoked_at,
        c.revoke_reason,
        c.created_at,
        COALESCE(u_internal.display_name, u_internal.email) as internal_signer_name,
        u_internal.email as internal_signer_email
      FROM hr_contracts c
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      WHERE c.signing_token = ?`,
      [token]
    );

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found. The link may be invalid.' },
        { status: 404 }
      );
    }

    // Check token expiration
    if (isTokenExpired(contract.token_expires_at)) {
      return NextResponse.json(
        {
          error: 'Signing link has expired',
          contract: {
            title: contract.title,
            status: 'expired',
          },
        },
        { status: 403 }
      );
    }

    // Check if contract is revoked
    if (contract.status === 'revoked') {
      return NextResponse.json(
        {
          error: 'This contract has been revoked',
          contract: {
            title: contract.title,
            status: 'revoked',
            revoke_reason: contract.revoke_reason,
          },
        },
        { status: 403 }
      );
    }

    // Check if contract is already completed
    if (contract.status === 'completed') {
      return NextResponse.json(
        {
          error: 'This contract has already been signed',
          contract: {
            title: contract.title,
            status: 'completed',
            external_signed_at: contract.external_signed_at,
          },
        },
        { status: 400 }
      );
    }

    // Check if contract is ready for external signing
    if (contract.status !== 'pending_external') {
      return NextResponse.json(
        {
          error: 'This contract is not ready for signing',
          contract: {
            title: contract.title,
            status: contract.status,
          },
        },
        { status: 400 }
      );
    }

    // Return contract details (excluding sensitive internal data)
    return NextResponse.json({
      id: contract.id,
      title: contract.title,
      document_type: contract.document_type,
      description: contract.description,
      document_url: contract.document_url,
      status: contract.status,
      external_signer_name: contract.external_signer_name,
      external_signer_email: contract.external_signer_email,
      internal_signer_name: contract.internal_signer_name,
      internal_signed_at: contract.internal_signed_at,
      sent_to_external_at: contract.sent_to_external_at,
      created_at: contract.created_at,
    });
  } catch (error: any) {
    console.error('Get contract by token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
