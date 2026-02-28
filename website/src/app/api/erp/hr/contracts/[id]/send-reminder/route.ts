import { NextRequest, NextResponse } from 'next/server';
import { requireERPPermission, logERPAction } from '@/lib/erp';
import { query, queryOne } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { getClientIp, getUserAgent } from '@/lib/contract-storage';
import { sendContractReminder } from '@/lib/email';

// POST /api/erp/hr/contracts/[id]/send-reminder - Send reminder email for unsigned contract
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
      `SELECT * FROM hr_contracts WHERE id = ?`,
      [contractId]
    );

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Validate contract state
    if (contract.status !== 'pending_external') {
      return NextResponse.json(
        { error: 'Can only send reminders for contracts pending external signature' },
        { status: 400 }
      );
    }

    if (!contract.external_signer_email) {
      return NextResponse.json(
        { error: 'External signer email is required' },
        { status: 400 }
      );
    }

    if (!contract.sent_to_external_at) {
      return NextResponse.json(
        { error: 'Contract has not been sent to external party yet' },
        { status: 400 }
      );
    }

    // Check reminder limit (max 3 reminders)
    const MAX_REMINDERS = 3;
    if (contract.reminder_count >= MAX_REMINDERS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_REMINDERS} reminders have been sent` },
        { status: 400 }
      );
    }

    // Calculate days since sent
    const sentDate = new Date(contract.sent_to_external_at);
    const now = new Date();
    const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

    // Build signing link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const signingLink = `${baseUrl}/contracts/sign/${contract.signing_token}`;

    // Send reminder email
    const emailResult = await sendContractReminder(
      contract.external_signer_email,
      contract.external_signer_name || 'Recipient',
      contract.title,
      signingLink,
      daysSinceSent
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to send reminder email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    const nowISO = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Update contract
    await query(
      `UPDATE hr_contracts
       SET last_reminder_sent_at = ?,
           reminder_count = reminder_count + 1
       WHERE id = ?`,
      [nowISO, contractId]
    );

    // Log the reminder
    const ipAddress = getClientIp(request);
    const userAgent = getUserAgent(request);

    await query(
      `INSERT INTO hr_contract_audit_log (
        contract_id, action, user_id, user_name, user_email, ip_address, user_agent, notes
      ) VALUES (?, 'reminder_sent', ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        auth.userId,
        auth.userName,
        auth.userEmail,
        ipAddress,
        userAgent,
        `Reminder ${contract.reminder_count + 1} sent to ${contract.external_signer_email}`,
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
      message: `Reminder sent to ${contract.external_signer_email}`,
      contract: updatedContract,
      reminders_sent: (contract.reminder_count || 0) + 1,
      reminders_remaining: MAX_REMINDERS - (contract.reminder_count || 0) - 1,
    });
  } catch (error: any) {
    console.error('Send reminder error:', error);
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
