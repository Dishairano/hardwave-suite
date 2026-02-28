import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction, buildPaginationResponse } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import {
  saveContractFile,
  generateSecureFilename,
  generateSigningToken,
  getTokenExpirationDate,
  getClientIp,
  getUserAgent,
} from '@/lib/contract-storage';

// GET /api/erp/hr/contracts - List all contracts
export async function GET(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'read');
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const entityType = searchParams.get('entity_type');
    const documentType = searchParams.get('document_type');

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (
        c.title LIKE ? OR c.description LIKE ? OR c.external_signer_name LIKE ? OR c.external_signer_email LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    if (entityType) {
      whereClause += ' AND c.entity_type = ?';
      params.push(entityType);
    }

    if (documentType) {
      whereClause += ' AND c.document_type = ?';
      params.push(documentType);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM hr_contracts c ${whereClause}`,
      params
    );
    const total = countResult?.total || 0;

    const sql = `
      SELECT
        c.*,
        COALESCE(u_creator.display_name, u_creator.email) as created_by_name,
        COALESCE(u_internal.display_name, u_internal.email) as internal_signer_name,
        u_internal.email as internal_signer_email,
        COALESCE(u_revoker.display_name, u_revoker.email) as revoked_by_name
      FROM hr_contracts c
      LEFT JOIN users u_creator ON c.created_by = u_creator.id
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      LEFT JOIN users u_revoker ON c.revoked_by = u_revoker.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const contracts = await query<HRContract[]>(sql, [...params, limit, offset]);

    return NextResponse.json(buildPaginationResponse(contracts, total, page, limit));
  } catch (error: any) {
    console.error('Get contracts error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/erp/hr/contracts - Create new contract
export async function POST(request: NextRequest) {
  try {
    const auth = await requireERPPermission(request, 'hr', 'write');
    const formData = await request.formData();

    const title = formData.get('title') as string;
    const documentType = formData.get('document_type') as string;
    const description = formData.get('description') as string | null;
    const entityType = (formData.get('entity_type') as string) || 'standalone';
    const entityId = formData.get('entity_id') ? parseInt(formData.get('entity_id') as string) : null;
    const externalSignerName = formData.get('external_signer_name') as string;
    const externalSignerEmail = formData.get('external_signer_email') as string;
    const internalSignerId = formData.get('internal_signer_id') ? parseInt(formData.get('internal_signer_id') as string) : null;
    const file = formData.get('file') as File | null;

    // Validation
    if (!title || !documentType || !externalSignerName || !externalSignerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: title, document_type, external_signer_name, external_signer_email' },
        { status: 400 }
      );
    }

    // Generate signing token
    const signingToken = generateSigningToken();
    const tokenExpiresAt = getTokenExpirationDate();

    // Create contract record first
    const insertResult = await query<any>(
      `INSERT INTO hr_contracts (
        title, document_type, description, status, entity_type, entity_id,
        external_signer_name, external_signer_email, internal_signer_id,
        signing_token, token_expires_at, created_by
      ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        documentType,
        description,
        entityType,
        entityId,
        externalSignerName,
        externalSignerEmail,
        internalSignerId,
        signingToken,
        tokenExpiresAt,
        auth.userId,
      ]
    );

    const contractId = insertResult.insertId;

    // Handle file upload if provided
    let documentUrl = null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = generateSecureFilename(contractId, file.name);
      documentUrl = await saveContractFile(buffer, filename);

      // Update contract with document URL
      await query(
        `UPDATE hr_contracts SET document_url = ? WHERE id = ?`,
        [documentUrl, contractId]
      );
    }

    // Log creation action
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'created', ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        auth.userId,
        auth.userName,
        auth.userEmail,
        ipAddress,
        userAgent,
        file ? 'Contract created with document' : 'Contract created without document',
      ]
    );

    if (file) {
      await query(
        `INSERT INTO hr_contract_audit_log (
          contract_id, action, user_id, user_name, user_email, ip_address, user_agent
        ) VALUES (?, 'uploaded', ?, ?, ?, ?, ?)`,
        [contractId, auth.userId, auth.userName, auth.userEmail, ipAddress, userAgent]
      );
    }

    await logERPAction({
      user_id: auth.userId,
      action: 'create',
      module: 'hr',
      entity_type: 'contract',
      entity_id: contractId,
      ip_address: ipAddress,
    });

    // Fetch and return the created contract
    const contract = await queryOne<HRContract>(
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

    return NextResponse.json(contract, { status: 201 });
  } catch (error: any) {
    console.error('Create contract error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
