/**
 * ZYRA — Email Templates
 *
 * Responsive HTML email templates with inline CSS for
 * maximum email client compatibility (no <style> blocks).
 * Uses simple string interpolation for personalisation.
 */

export type TemplateName =
  | 'welcome'
  | 'password-reset'
  | 'order-confirmation'
  | 'invoice'
  | 'otp';

type RenderFn = (data: Record<string, string>) => { subject: string; html: string; text: string };

const brandColor = '#6C47FF';   // ZYRA primary
const brandColorDark = '#5535DB';
const brandColorBg = '#F5F3FF';
const textColor = '#1F2937';
const mutedColor = '#6B7280';
const white = '#FFFFFF';

const emailWrapper = (bodyContent: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>ZYRA</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:${white};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:${brandColor};padding:24px 32px;text-align:center;">
              <span style="color:${white};font-size:24px;font-weight:700;letter-spacing:-0.5px;">ZYRA</span>
              <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:4px 0 0;">Commerce Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;text-align:center;">
              <p style="color:${mutedColor};font-size:12px;margin:0 0 4px;">&copy; ${new Date().getFullYear()} ZYRA. All rights reserved.</p>
              <p style="color:${mutedColor};font-size:12px;margin:0;">
                <a href="https://ceozyra.com" style="color:${brandColor};text-decoration:none;">ceozyra.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const greeting = (name: string): string =>
  `<p style="color:${textColor};font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(name)},</p>`;

const closing = (): string =>
  `<p style="color:${textColor};font-size:14px;line-height:1.6;margin:24px 0 0;">Need help? Reach out to our support team at <a href="mailto:support@ceozyra.com" style="color:${brandColor};text-decoration:none;">support@ceozyra.com</a>.</p>`;

const button = (label: string, url: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:${brandColor};border-radius:8px;padding:12px 24px;">
        <a href="${url}" style="color:${white};font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;

const divider = (): string =>
  `<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">`;

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const emailTemplates: Record<TemplateName, RenderFn> = {
  welcome: (data) => {
    const body = `
      ${greeting(data.name || 'there')}
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 12px;">Welcome to <strong>ZYRA</strong> — we're excited to have you on board!</p>
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 16px;">Your account has been created successfully. You can now explore our products, place orders, and manage your business all in one place.</p>
      ${button('Get Started', data.loginUrl || 'https://ceozyra.com')}
      ${closing()}
    `;
    return {
      subject: 'Welcome to ZYRA — Your Account is Ready',
      html: emailWrapper(body),
      text: `Welcome to ZYRA!\n\nHi ${data.name || 'there'},\n\nYour account has been created. Get started at: ${data.loginUrl || 'https://ceozyra.com'}\n\nNeed help? support@ceozyra.com`,
    };
  },

  'password-reset': (data) => {
    const body = `
      ${greeting(data.name || 'there')}
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 12px;">We received a request to reset your ZYRA account password. Click the button below to choose a new password:</p>
      ${button('Reset Password', data.resetUrl || '#')}
      <p style="color:${mutedColor};font-size:13px;line-height:1.6;margin:16px 0 0;">This link will expire in <strong>15 minutes</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
      <p style="color:${mutedColor};font-size:13px;line-height:1.6;margin:8px 0 0;">If the button doesn't work, copy and paste this URL into your browser:</p>
      <p style="color:${brandColor};font-size:12px;word-break:break-all;margin:4px 0 0;">${escapeHtml(data.resetUrl || '#')}</p>
      ${closing()}
    `;
    return {
      subject: 'Reset Your ZYRA Password',
      html: emailWrapper(body),
      text: `Password Reset\n\nHi ${data.name || 'there'},\n\nReset your password: ${data.resetUrl || '#'}\n\nThis link expires in 15 minutes.\n\nsupport@ceozyra.com`,
    };
  },

  'order-confirmation': (data) => {
    const items = (data.items || '')
      .split('|')
      .map((item, i) => {
        const [name, qty, price] = item.split(':');
        return `<tr style="border-bottom:1px solid #E5E7EB;">
          <td style="padding:10px 0;color:${textColor};font-size:14px;">${escapeHtml(name || 'Item')}</td>
          <td style="padding:10px 0;color:${textColor};font-size:14px;text-align:center;">${escapeHtml(qty || '1')}</td>
          <td style="padding:10px 0;color:${textColor};font-size:14px;text-align:right;">₹${escapeHtml(price || '0.00')}</td>
        </tr>`;
      })
      .join('');

    const body = `
      ${greeting(data.name || 'there')}
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 12px;">Thank you for your order! Here's your confirmation:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${brandColorBg};border-radius:8px;padding:16px;margin-bottom:16px;">
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Order ID</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:${textColor};text-align:right;">${escapeHtml(data.orderId || '—')}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Date</td><td style="padding:4px 0;font-size:14px;color:${textColor};text-align:right;">${escapeHtml(data.date || '—')}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Total</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:${brandColor};text-align:right;">${escapeHtml(data.total || '₹0.00')}</td></tr>
      </table>
      <p style="color:${textColor};font-size:13px;font-weight:600;margin:0 0 8px;">Items</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <thead>
          <tr style="border-bottom:2px solid ${brandColor};">
            <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:left;">Product</th>
            <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:center;">Qty</th>
            <th style="padding:8px 0;font-size:12px;font-weight:600;color:${mutedColor};text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>${items || ''}</tbody>
      </table>
      ${button('View Order', data.orderUrl || 'https://ceozyra.com')}
      ${closing()}
    `;
    return {
      subject: `Order Confirmed — ${data.orderId || 'ZYRA Order'}`,
      html: emailWrapper(body),
      text: `Order Confirmation\n\nOrder ID: ${data.orderId || '—'}\nTotal: ${data.total || '₹0.00'}\n\nView your order: ${data.orderUrl || 'https://ceozyra.com'}\n\nsupport@ceozyra.com`,
    };
  },

  invoice: (data) => {
    const body = `
      ${greeting(data.name || 'there')}
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 16px;">Your invoice for order <strong>${escapeHtml(data.orderId || '—')}</strong> is ready.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${brandColorBg};border-radius:8px;padding:16px;margin-bottom:16px;">
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Invoice #</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:${textColor};text-align:right;">${escapeHtml(data.invoiceId || '—')}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Date</td><td style="padding:4px 0;font-size:14px;color:${textColor};text-align:right;">${escapeHtml(data.date || '—')}</td></tr>
        <tr><td style="padding:4px 0;font-size:13px;color:${mutedColor};">Amount</td><td style="padding:4px 0;font-size:14px;font-weight:600;color:${brandColor};text-align:right;">${escapeHtml(data.total || '₹0.00')}</td></tr>
      </table>
      ${button('Download Invoice', data.invoiceUrl || '#')}
      ${closing()}
    `;
    return {
      subject: `Invoice ${data.invoiceId || 'ZYRA'} — ${data.total || '₹0.00'}`,
      html: emailWrapper(body),
      text: `Invoice\n\nInvoice: ${data.invoiceId || '—'}\nAmount: ${data.total || '₹0.00'}\n\nDownload: ${data.invoiceUrl || '#'}\n\nsupport@ceozyra.com`,
    };
  },

  otp: (data) => {
    const body = `
      ${greeting(data.name || 'there')}
      <p style="color:${textColor};font-size:14px;line-height:1.7;margin:0 0 16px;">Use the following one-time passcode to sign in to your ZYRA account:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
        <tr>
          <td align="center" style="background-color:${brandColorBg};border:2px dashed ${brandColor};border-radius:12px;padding:20px 32px;">
            <span style="color:${brandColor};font-size:32px;font-weight:700;letter-spacing:8px;font-family:monospace;">${escapeHtml(data.otp || '000000')}</span>
          </td>
        </tr>
      </table>
      <p style="color:${mutedColor};font-size:13px;line-height:1.6;margin:16px 0 0;">This code expires in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.</p>
      ${closing()}
    `;
    return {
      subject: 'Your ZYRA Sign-in Code',
      html: emailWrapper(body),
      text: `Your ZYRA sign-in code is: ${data.otp || '000000'}\n\nThis code expires in 10 minutes.\n\nsupport@ceozyra.com`,
    };
  },
};

export const templateList: { name: TemplateName; description: string }[] = [
  { name: 'welcome', description: 'Sent to new users after account creation' },
  { name: 'password-reset', description: 'Sent when a user requests a password reset' },
  { name: 'order-confirmation', description: 'Sent to customers after a successful order' },
  { name: 'invoice', description: 'Sent to customers with a downloadable invoice' },
  { name: 'otp', description: 'One-time passcode for email-based sign-in' },
];

export function renderTemplate(name: TemplateName, data: Record<string, string>) {
  const renderer = emailTemplates[name];
  if (!renderer) {
    throw new Error(`Unknown email template: ${name}. Available: ${Object.keys(emailTemplates).join(', ')}`);
  }
  return renderer(data);
}
