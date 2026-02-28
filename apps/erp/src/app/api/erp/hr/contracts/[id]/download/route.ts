import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { readFile } from 'fs/promises';
import { join } from 'path';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

// GET /api/erp/hr/contracts/[id]/download?token=xxx - Download contract PDF
// Requires either: ?token= (signing token from email) or Authorization: Bearer header
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contractId = parseInt(id);

    if (isNaN(contractId)) {
      return NextResponse.json({ error: 'Invalid contract ID' }, { status: 400 });
    }

    const contract = await queryOne<HRContract>(
      `SELECT id, title, document_url, status, signing_token FROM hr_contracts WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Auth check: either signing token or JWT Bearer
    const { searchParams } = new URL(request.url);
    const downloadToken = searchParams.get('token');
    const authHeader = request.headers.get('authorization');
    let authorized = false;

    // Check signing token from email link
    if (downloadToken && contract.signing_token && downloadToken === contract.signing_token) {
      authorized = true;
    }

    // Check JWT Bearer token (logged-in users)
    if (!authorized && authHeader?.startsWith('Bearer ')) {
      try {
        jwt.verify(authHeader.slice(7), JWT_SECRET);
        authorized = true;
      } catch {
        // Invalid JWT, continue to deny
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!contract.document_url) {
      return NextResponse.json({ error: 'No document attached to this contract' }, { status: 404 });
    }

    const filePath = join(process.cwd(), 'public', contract.document_url);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: 'Document file not found on server' }, { status: 404 });
    }

    const filename = `${contract.title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.pdf`;

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download contract error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
