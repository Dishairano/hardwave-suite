import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailcowdockerized-postfix-mailcow-1',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'docusign@hardwavestudios.com',
    pass: process.env.SMTP_PASSWORD || '',
  },
  tls: {
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
  },
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'Hardwave Studios <docusign@hardwavestudios.com>';

async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to,
    subject: 'Reset Your Password - Hardwave Studios',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #08080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080c; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="max-width: 480px;">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FFA500, #FF6B00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px; font-weight: bold; color: #08080c;">H</span>
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Reset Your Password</h1>
                  </td>
                </tr>

                <!-- Message -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.6);">
                      We received a request to reset your password. Click the button below to create a new password. This link expires in 1 hour.
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #FFA500; color: #08080c; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>

                <!-- Alternative link -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.4);">
                      Or copy this link:<br>
                      <a href="${resetLink}" style="color: #FFA500; word-break: break-all;">${resetLink}</a>
                    </p>
                  </td>
                </tr>

                <!-- Disclaimer -->
                <tr>
                  <td align="center" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.3);">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.2);">
                      Hardwave Studios
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Reset Your Password

We received a request to reset your password. Click the link below to create a new password. This link expires in 1 hour.

${resetLink}

If you didn't request this, you can safely ignore this email.

Hardwave Studios`,
  });
}

/**
 * Send contract signing invitation to external party
 */
export async function sendContractSigningInvitation(
  to: string,
  signerName: string,
  contractTitle: string,
  signingLink: string,
  internalSignerName: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to,
    subject: `Action Required: Sign ${contractTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #08080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080c; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FFA500, #FF6B00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px; font-weight: bold; color: #08080c;">H</span>
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Document Signature Required</h1>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td align="left" style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.8);">
                      Hello ${signerName},
                    </p>
                  </td>
                </tr>

                <!-- Message -->
                <tr>
                  <td align="left" style="padding-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.6);">
                      ${internalSignerName} from Hardwave Studios has sent you a document that requires your signature:
                    </p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #FFA500;">
                      ${contractTitle}
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${signingLink}" style="display: inline-block; padding: 14px 32px; background-color: #FFA500; color: #08080c; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Review & Sign Document
                    </a>
                  </td>
                </tr>

                <!-- Alternative link -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.4);">
                      Or copy this link:<br>
                      <a href="${signingLink}" style="color: #FFA500; word-break: break-all;">${signingLink}</a>
                    </p>
                  </td>
                </tr>

                <!-- Expiration notice -->
                <tr>
                  <td align="center" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.3);">
                      This signing link will expire in 30 days.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.2);">
                      Hardwave Studios
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Document Signature Required

Hello ${signerName},

${internalSignerName} from Hardwave Studios has sent you a document that requires your signature:

${contractTitle}

Click the link below to review and sign the document:
${signingLink}

This signing link will expire in 30 days.

Hardwave Studios`,
  });
}

/**
 * Send reminder email for unsigned contract
 */
export async function sendContractReminder(
  to: string,
  signerName: string,
  contractTitle: string,
  signingLink: string,
  daysSinceSent: number
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to,
    subject: `Reminder: ${contractTitle} Awaiting Your Signature`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #08080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080c; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #FFA500, #FF6B00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px; font-weight: bold; color: #08080c;">H</span>
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Signature Reminder</h1>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td align="left" style="padding-bottom: 24px;">
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.8);">
                      Hello ${signerName},
                    </p>
                  </td>
                </tr>

                <!-- Message -->
                <tr>
                  <td align="left" style="padding-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.6);">
                      This is a friendly reminder that the following document is still awaiting your signature:
                    </p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #FFA500;">
                      ${contractTitle}
                    </p>
                    <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.4);">
                      Sent ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} ago
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${signingLink}" style="display: inline-block; padding: 14px 32px; background-color: #FFA500; color: #08080c; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Sign Document Now
                    </a>
                  </td>
                </tr>

                <!-- Alternative link -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.4);">
                      Or copy this link:<br>
                      <a href="${signingLink}" style="color: #FFA500; word-break: break-all;">${signingLink}</a>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.2);">
                      Hardwave Studios
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Signature Reminder

Hello ${signerName},

This is a friendly reminder that the following document is still awaiting your signature:

${contractTitle}

Sent ${daysSinceSent} day${daysSinceSent !== 1 ? 's' : ''} ago

Click the link below to sign:
${signingLink}

Hardwave Studios`,
  });
}

/**
 * Send contract completion confirmation to both parties
 */
export async function sendContractCompletionEmail(
  recipients: string[],
  contractTitle: string,
  downloadLink: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to: recipients,
    subject: `${contractTitle} - Fully Executed`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #08080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080c; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px; color: #08080c;">&#10003;</span>
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Document Fully Executed</h1>
                  </td>
                </tr>

                <!-- Message -->
                <tr>
                  <td align="left" style="padding-bottom: 32px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.6);">
                      The following document has been signed by all parties and is now fully executed:
                    </p>
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #10B981;">
                      ${contractTitle}
                    </p>
                  </td>
                </tr>

                <!-- Button -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <a href="${downloadLink}" style="display: inline-block; padding: 14px 32px; background-color: #10B981; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Download Signed Document
                    </a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.3);">
                      Please keep this document for your records.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.2);">
                      Hardwave Studios
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Document Fully Executed

The following document has been signed by all parties and is now fully executed:

${contractTitle}

Download your signed copy: ${downloadLink}

Please keep this document for your records.

Hardwave Studios`,
  });
}

/**
 * Send contract revocation notification
 */
export async function sendContractRevocationEmail(
  to: string,
  contractTitle: string,
  revokeReason: string
): Promise<{ success: boolean; error?: string }> {
  return sendMail({
    to,
    subject: `${contractTitle} - Revoked`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #08080c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080c; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px;">
                <!-- Logo -->
                <tr>
                  <td align="center" style="padding-bottom: 32px;">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #EF4444, #DC2626); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px; color: #ffffff;">&#9888;</span>
                    </div>
                  </td>
                </tr>

                <!-- Title -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">Document Revoked</h1>
                  </td>
                </tr>

                <!-- Message -->
                <tr>
                  <td align="left" style="padding-bottom: 24px;">
                    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.6);">
                      The following document has been revoked:
                    </p>
                    <p style="margin: 0 0 24px 0; font-size: 16px; font-weight: 600; color: #EF4444;">
                      ${contractTitle}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8);">
                      Reason:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6);">
                      ${revokeReason || 'No reason provided'}
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td align="center" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.3);">
                      If you have questions, please contact Hardwave Studios.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.2);">
                      Hardwave Studios
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Document Revoked

The following document has been revoked:

${contractTitle}

Reason: ${revokeReason || 'No reason provided'}

If you have questions, please contact Hardwave Studios.

Hardwave Studios`,
  });
}
