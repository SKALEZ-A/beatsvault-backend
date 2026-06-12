// backend/src/lib/email.js
// Sends download emails via Resend after payment confirmed

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = `${process.env.EMAIL_FROM_NAME || 'BeatVault'} <${process.env.EMAIL_FROM}>`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Send download email after successful payment
 * @param {{ to: string, name: string, items: Array, downloadToken: string }} params
 */
async function sendDownloadEmail({ to, name, items, downloadToken }) {
  const downloadUrl = `${FRONTEND_URL}/download/${downloadToken}`;

  const itemRows = items
    .map(
      i => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px">${i.beat?.title || i.title}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center">${i.license}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right">₦${Number(i.price).toLocaleString()}</td>
      </tr>`
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee">
      <div style="background:#1a1aff;padding:32px;text-align:center">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:500">🎵 BeatVault</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Payment confirmed</p>
      </div>
      <div style="padding:32px">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:500">Your beats are ready, ${name}!</h2>
        <p style="margin:0 0 24px;color:#666;font-size:14px">
          Download your files using the link below. It expires in <strong>48 hours</strong>.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <thead>
            <tr>
              <th style="text-align:left;font-size:12px;color:#999;padding-bottom:8px;border-bottom:2px solid #eee;font-weight:500;text-transform:uppercase">Beat</th>
              <th style="text-align:center;font-size:12px;color:#999;padding-bottom:8px;border-bottom:2px solid #eee;font-weight:500;text-transform:uppercase">License</th>
              <th style="text-align:right;font-size:12px;color:#999;padding-bottom:8px;border-bottom:2px solid #eee;font-weight:500;text-transform:uppercase">Price</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <a href="${downloadUrl}"
          style="display:block;background:#1a1aff;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:8px;font-size:15px;font-weight:500;margin-bottom:16px">
          ⬇️ Download your beats
        </a>

        <p style="margin:0;font-size:12px;color:#999;text-align:center">
          Or copy this link: <a href="${downloadUrl}" style="color:#1a1aff">${downloadUrl}</a>
        </p>
      </div>
      <div style="padding:20px 32px;background:#f9f9f9;border-top:1px solid #eee;text-align:center">
        <p style="margin:0;font-size:12px;color:#999">
          Need help? Reply to this email or contact us.<br/>
          © BeatVault — All rights reserved.
        </p>
      </div>
    </div>
  </body>
  </html>`;

  const result = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your beats are ready — BeatVault`,
    html,
  });

  if (result.error) {
    console.error('Email send failed:', result.error);
    throw new Error(`Email failed: ${result.error.message}`);
  }

  console.log(`📧 Download email sent to ${to} (id: ${result.data?.id})`);
  return result;
}

module.exports = { sendDownloadEmail };
