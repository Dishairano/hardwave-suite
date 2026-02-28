import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { HRContract } from '@/lib/erp-types';
import { sendContractReminder } from '@/lib/email';

// GET /api/cron/contract-reminders - Automated contract reminder cron job
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const MAX_REMINDERS = 3;
    const REMINDER_INTERVAL_DAYS = 3;

    // Find contracts that need reminders
    // - Status is pending_external
    // - Sent at least REMINDER_INTERVAL_DAYS days ago
    // - Reminder count is less than MAX_REMINDERS
    // - Either never reminded, or last reminder was at least REMINDER_INTERVAL_DAYS days ago

    const contracts = await query<HRContract[]>(
      `SELECT
        c.*,
        u_internal.email as internal_signer_email
      FROM hr_contracts c
      LEFT JOIN users u_internal ON c.internal_signer_id = u_internal.id
      WHERE c.status = 'pending_external'
        AND c.sent_to_external_at IS NOT NULL
        AND c.external_signer_email IS NOT NULL
        AND c.reminder_count < ?
        AND (
          (c.last_reminder_sent_at IS NULL AND DATEDIFF(NOW(), c.sent_to_external_at) >= ?)
          OR
          (c.last_reminder_sent_at IS NOT NULL AND DATEDIFF(NOW(), c.last_reminder_sent_at) >= ?)
        )
      ORDER BY c.sent_to_external_at ASC
      LIMIT 50`,
      [MAX_REMINDERS, REMINDER_INTERVAL_DAYS, REMINDER_INTERVAL_DAYS]
    );

    const results = {
      total: contracts.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const contract of contracts) {
      try {
        // Calculate days since sent
        const sentDate = new Date(contract.sent_to_external_at!);
        const now = new Date();
        const daysSinceSent = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));

        // Build signing link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const signingLink = `${baseUrl}/contracts/sign/${contract.signing_token}`;

        // Send reminder email
        const emailResult = await sendContractReminder(
          contract.external_signer_email!,
          contract.external_signer_name || 'Recipient',
          contract.title,
          signingLink,
          daysSinceSent
        );

        if (emailResult.success) {
          // Update contract
          const nowISO = new Date().toISOString();
          await query(
            `UPDATE hr_contracts
             SET last_reminder_sent_at = ?,
                 reminder_count = reminder_count + 1
             WHERE id = ?`,
            [nowISO, contract.id]
          );

          // Log the reminder
          await query(
            `INSERT INTO hr_contract_audit_log (
              contract_id, action, user_id, user_name, user_email, notes
            ) VALUES (?, 'reminder_sent', NULL, 'System', NULL, ?)`,
            [
              contract.id,
              `Automated reminder ${contract.reminder_count + 1} sent to ${contract.external_signer_email}`,
            ]
          );

          results.sent++;
        } else {
          results.failed++;
          results.errors.push(
            `Contract ${contract.id}: ${emailResult.error}`
          );
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(
          `Contract ${contract.id}: ${error.message || 'Unknown error'}`
        );
        console.error(`Failed to send reminder for contract ${contract.id}:`, error);
      }
    }

    console.log('Contract reminder cron job completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Contract reminder job completed',
      results,
    });
  } catch (error: any) {
    console.error('Contract reminder cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
