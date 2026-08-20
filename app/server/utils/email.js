const nodemailer = require('nodemailer');
const { toAbsoluteUrl } = require('./public-url');

function buildAppUrl() {
  return (process.env.PUBLIC_APP_URL || 'https://bestworthproductsltd.ng').replace(/\/$/, '');
}

function buildPublicWebsiteUrl() {
  return buildAppUrl();
}

function normalizePlatformName(value = '') {
  return String(value).trim().toLowerCase();
}

function buildPhoneHref(value = '') {
  const trimmedValue = String(value).trim();
  if (!trimmedValue) return '';
  if (/^tel:/i.test(trimmedValue)) return trimmedValue;
  return `tel:${trimmedValue}`;
}

function buildWhatsAppHref(value = '') {
  const trimmedValue = String(value).trim();
  if (!trimmedValue) return '';
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;
  const digitsOnly = trimmedValue.replace(/[^\d+]/g, '');
  return `https://wa.me/${digitsOnly.replace(/^\+/, '')}`;
}

function makePseudoRequest(appUrl) {
  return {
    protocol: appUrl.startsWith('https://') ? 'https' : 'http',
    get(name) {
      return name === 'host' ? appUrl.replace(/^https?:\/\//, '') : '';
    },
    headers: {}
  };
}

function summarizeMailConfig() {
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const smtpSecure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.EMAIL_SECURE === 'true' ||
    smtpPort === 465;

  return {
    provider: process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'smtp'),
    mode: smtpHost ? 'smtp-host' : 'service',
    host: smtpHost || null,
    port: smtpHost ? smtpPort : null,
    secure: smtpHost ? smtpSecure : null,
    service: smtpHost ? null : (process.env.EMAIL_SERVICE || 'gmail'),
    hasEmailUser: Boolean(process.env.EMAIL_USER),
    hasEmailPass: Boolean(process.env.EMAIL_PASS),
    hasCompanyEmail: Boolean(process.env.COMPANY_EMAIL),
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    hasSendGridKey: Boolean(process.env.SENDGRID_API_KEY),
    publicAppUrl: buildAppUrl()
  };
}

function createSmtpTransporter() {
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const smtpSecure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.EMAIL_SECURE === 'true' ||
    smtpPort === 465;

  const mailConfig = smtpHost
    ? {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        dnsTimeout: 10000,
        requireTLS: !smtpSecure,
        logger: true,
        debug: true,
        tls: {
          servername: smtpHost
        },
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      }
    : {
        service: process.env.EMAIL_SERVICE || 'gmail',
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        dnsTimeout: 10000,
        logger: true,
        debug: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      };

  return nodemailer.createTransport(mailConfig);
}

const smtpTransporter = createSmtpTransporter();
let verifyPromise = null;

function getCompanyRecipients(cmsData = {}) {
  const configuredRecipients = Array.isArray(cmsData.notificationEmails)
    ? cmsData.notificationEmails.filter(Boolean)
    : [];

  if (configuredRecipients.length > 0) {
    return configuredRecipients;
  }

  const envRecipients = String(process.env.COMPANY_EMAIL || process.env.EMAIL_USER || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return envRecipients;
}

async function fetchAssetAsAttachment(url, fallbackName, contentId) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Asset request failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const fileExtension = contentType.split('/')[1]?.split(';')[0] || 'bin';
    const filename = `${fallbackName}.${fileExtension.replace('svg+xml', 'svg')}`;
    const contentBuffer = Buffer.from(arrayBuffer);

    return {
      filename,
      content: contentBuffer,
      contentType,
      disposition: 'inline',
      cid: contentId
    };
  } catch (error) {
    console.error('[email] failed to fetch branding asset', {
      url,
      contentId,
      message: error.message
    });
    return null;
  }
}

async function verifySmtpTransporter() {
  if (!verifyPromise) {
    console.log('[email] starting transporter verification', summarizeMailConfig());
    verifyPromise = Promise.race([
      smtpTransporter.verify(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SMTP verification timed out')), 12000);
      })
    ])
      .then((result) => {
        console.log('[email] transporter verification succeeded', { result });
        return result;
      })
      .catch((error) => {
        console.error('[email] transporter verification failed', {
          message: error.message,
          code: error.code,
          command: error.command,
          response: error.response,
          responseCode: error.responseCode
        });
        verifyPromise = null;
        throw error;
      });
  }

  return verifyPromise;
}

async function buildEmailBranding(cmsData = {}) {
  const brandColor = '#060273';
  const charcoal = '#102B4C';
  const accentColor = '#D64545';
  const lightBg = '#F3F6FA';
  const appUrl = buildAppUrl();
  const requestLike = makePseudoRequest(appUrl);

  const contact = cmsData.contact || {};
  const footerData = cmsData.footer || {};
  const branding = cmsData.branding || {};

  const address = contact.address || 'Plot 15, Industrial Estate, Phase II, Lagos, Nigeria';
  const website = buildPublicWebsiteUrl();
  const linkedin = footerData.socials?.linkedin || 'https://linkedin.com/company/bestworth';
  const footerExtraLinks = Array.isArray(footerData.socials?.extra) ? footerData.socials.extra : [];
  const whatsappEntry = footerExtraLinks.find((item) => normalizePlatformName(item?.label) === 'whatsapp');
  const phoneEntry = footerExtraLinks.find((item) => ['phone', 'telephone', 'call'].includes(normalizePlatformName(item?.label)));
  const phoneValue = phoneEntry?.url || contact.phone || '';
  const contactLink = whatsappEntry?.url
    ? {
        href: buildWhatsAppHref(whatsappEntry.url),
        label: 'WHATSAPP'
      }
    : phoneValue
      ? {
          href: buildPhoneHref(phoneValue),
          label: 'PHONE'
        }
      : null;

  const logoUrl = toAbsoluteUrl(requestLike, branding.logoUrl || '/assets/Closed Sidebar Logo.jpg');
  const faviconUrl = toAbsoluteUrl(requestLike, branding.faviconUrl || '/assets/Favicon Logo.png');
  const logoAttachment = await fetchAssetAsAttachment(logoUrl, 'bestworth-logo', 'bestworth-logo');

  return {
    brandColor,
    charcoal,
    accentColor,
    lightBg,
    address,
    website,
    linkedin,
    contactLink,
    logoUrl,
    faviconUrl,
    logoSrc: logoAttachment ? 'cid:bestworth-logo' : logoUrl,
    attachments: logoAttachment ? [logoAttachment] : []
  };
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const EmailLayout = (content, previewText, brandingData, options = {}) => {
  const {
    brandColor,
    charcoal,
    accentColor,
    lightBg,
    address,
    website,
    linkedin,
    contactLink,
    logoSrc,
    faviconUrl
  } = brandingData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="shortcut icon" href="${faviconUrl}" type="image/x-icon">
      <title>Bestworth Products Limited</title>
    </head>
    <body style="margin:0;padding:0;background:${lightBg};font-family:Arial,Helvetica,sans-serif;color:${charcoal};">
      <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        ${escapeHtml(previewText)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${lightBg};padding:24px 10px;">
        <tr><td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dfe7f0;border-radius:10px;overflow:hidden;">
            <tr><td style="height:4px;background:${accentColor};font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr><td style="padding:26px 34px;background:${charcoal};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                <td><img src="${logoSrc}" alt="Bestworth Products Limited" style="display:block;height:36px;max-width:210px;width:auto;"></td>
                <td align="right" style="color:#b9c7d8;font-size:9px;letter-spacing:2px;text-transform:uppercase;">Built to last</td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:38px 34px;color:${charcoal};font-size:15px;line-height:1.7;">${content}</td></tr>
            <tr><td style="padding:26px 34px;background:#edf2f7;border-top:1px solid #dfe7f0;color:#60758b;font-size:11px;line-height:1.7;">
              ${options.footerExtra ? `<div style="margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #d8e1ea;">${options.footerExtra}</div>` : ''}
              <strong style="color:${charcoal};font-size:12px;">BESTWORTH PRODUCTS LIMITED</strong><br>
              ${escapeHtml(address)}<br>
              <a href="${website}" style="color:${brandColor};text-decoration:none;">Website</a>&nbsp;&nbsp;·&nbsp;&nbsp;
              <a href="${linkedin}" style="color:${brandColor};text-decoration:none;">LinkedIn</a>${contactLink ? `&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${contactLink.href}" style="color:${brandColor};text-decoration:none;">${contactLink.label}</a>` : ''}
              <div style="margin-top:12px;color:#8494a5;">&copy; ${new Date().getFullYear()} Bestworth Products Limited. All rights reserved.</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
};

async function sendWithResend(mailOptions) {
  console.log('[email] using resend provider', {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: mailOptions.from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      reply_to: mailOptions.replyTo,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      headers: mailOptions.headers,
      attachments: Array.isArray(mailOptions.attachments)
        ? mailOptions.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content.toString('base64'),
            content_type: attachment.contentType,
            content_id: attachment.cid,
            disposition: attachment.disposition || 'inline'
          }))
        : undefined
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || data?.error || `Resend request failed with status ${response.status}`;
    const error = new Error(message);
    error.responseCode = response.status;
    error.response = JSON.stringify(data);
    throw error;
  }

  console.log('[email] resend email sent', data);
  return data;
}

async function sendWithSendGrid(mailOptions) {
  console.log('[email] using sendgrid provider', {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject
  });

  console.log('[email] sendgrid request starting');
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: (Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]).map((email) => ({ email })),
          headers: mailOptions.headers
        }
      ],
      from: {
        email: mailOptions.from
      },
      reply_to: mailOptions.replyTo ? { email: mailOptions.replyTo } : undefined,
      subject: mailOptions.subject,
      content: [
        ...(mailOptions.text ? [{ type: 'text/plain', value: mailOptions.text }] : []),
        { type: 'text/html', value: mailOptions.html }
      ],
      attachments: Array.isArray(mailOptions.attachments)
        ? mailOptions.attachments.map((attachment) => ({
            content: attachment.content.toString('base64'),
            filename: attachment.filename,
            type: attachment.contentType,
            disposition: attachment.disposition || 'inline',
            content_id: attachment.cid
          }))
        : undefined
    })
  });

  console.log('[email] sendgrid response received', {
    status: response.status,
    ok: response.ok
  });
  const responseText = await response.text();

  if (!response.ok) {
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = null;
    }

    const message =
      parsed?.errors?.map((error) => error.message).join('; ') ||
      parsed?.message ||
      `SendGrid request failed with status ${response.status}`;

    const error = new Error(message);
    error.responseCode = response.status;
    error.response = responseText;
    throw error;
  }

  console.log('[email] sendgrid email sent', {
    status: response.status,
    response: responseText || 'accepted'
  });

  return { status: response.status, response: responseText || 'accepted' };
}

async function sendMail(mailOptions, contextLabel) {
  const provider = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'smtp');

  if (provider === 'resend') {
    return sendWithResend(mailOptions);
  }

  if (provider === 'sendgrid') {
    return sendWithSendGrid(mailOptions);
  }

  try {
    await verifySmtpTransporter();
  } catch (verifyError) {
    console.warn(`[email] continuing after verify failure for ${contextLabel}`, {
      message: verifyError.message
    });
  }

  console.log(`[email] sending ${contextLabel}`, {
    subject: mailOptions.subject,
    from: mailOptions.from,
    to: mailOptions.to,
    replyTo: mailOptions.replyTo
  });

  const info = await smtpTransporter.sendMail(mailOptions);
  console.log(`[email] ${contextLabel} sent`, {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  });
  return info;
}

const sendInquiryNotification = async (inquiry, cmsData = {}) => {
  const recipients = getCompanyRecipients(cmsData);
  console.log('[email] sendInquiryNotification triggered', {
    inquiryId: String(inquiry._id),
    to: recipients,
    replyTo: inquiry.email,
    hasBranding: Boolean(cmsData.branding),
    hasContact: Boolean(cmsData.contact),
    hasFooter: Boolean(cmsData.footer)
  });

  const appUrl = buildAppUrl();
  const brandingData = await buildEmailBranding(cmsData);
  const content = `
    <span style="display:block;margin-bottom:9px;color:#D64545;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">System notification</span>
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 28px;font-weight:600;letter-spacing:-0.4px;color:#102B4C;">New business inquiry</h1>
    <div style="margin-bottom: 25px;">
      <span style="display:block;color:#60758b;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">From</span>
      <div style="font-size:16px;font-weight:600;">${escapeHtml(inquiry.name)}</div>
      <div style="font-size:14px;color:#60758b;">${escapeHtml(inquiry.email)}</div>
    </div>
    <div style="margin-bottom: 25px;">
      <span style="display:block;color:#60758b;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Company</span>
      <div style="font-size:16px;">${escapeHtml(inquiry.company || 'Not specified')}</div>
    </div>
    <div style="height:1px;background:#e3e9f0;margin:28px 0;"></div>
    <span style="display:block;margin-bottom:9px;color:#60758b;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Message</span>
    <div style="background:#F3F6FA;padding:20px;border-left:3px solid #060273;color:#425a70;">
      ${escapeHtml(inquiry.message)}
    </div>
    <div style="margin-top: 40px;">
      <a href="${appUrl}/admin" style="display:inline-block;padding:12px 20px;border-radius:5px;background:#060273;color:#fff;text-decoration:none;font-size:11px;font-weight:700;">Open admin portal</a>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || `"Bestworth System" <${process.env.EMAIL_USER}>`,
    to: recipients,
    replyTo: inquiry.email,
    subject: `[Lead] New Inquiry from ${inquiry.company || inquiry.name}`,
    html: EmailLayout(
      content,
      `New inquiry received from ${inquiry.name} representing ${inquiry.company || 'Private'}`,
      brandingData
    ),
    attachments: brandingData.attachments
  };

  try {
    return await sendMail(mailOptions, 'inquiry notification');
  } catch (error) {
    console.error('[email] error sending inquiry notification', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    throw error;
  }
};

const sendInquiryConfirmation = async (inquiry, cmsData = {}) => {
  console.log('[email] sendInquiryConfirmation triggered', {
    inquiryId: String(inquiry._id),
    to: inquiry.email,
    hasBranding: Boolean(cmsData.branding),
    hasContact: Boolean(cmsData.contact),
    hasFooter: Boolean(cmsData.footer)
  });

  const brandingData = await buildEmailBranding(cmsData);
  const content = `
    <span style="display:block;margin-bottom:9px;color:#D64545;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Inquiry received</span>
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 28px;font-weight:600;color:#102B4C;">Thank you for contacting Bestworth</h1>
    <div style="font-size: 16px; color: #333; line-height: 1.8;">
      <div style="margin-bottom:15px;">Dear ${escapeHtml(inquiry.name)},</div>
      <div style="margin-bottom: 15px;">We have received your inquiry and our team will review it shortly.</div>
      <div style="margin-bottom: 15px;">A member of our team will get back to you using this email address as soon as possible.</div>
    </div>
    <div style="height:1px;background:#e3e9f0;margin:28px 0;"></div>
    <span style="display:block;margin-bottom:9px;color:#60758b;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Your message</span>
    <div style="background:#F3F6FA;padding:20px;border-left:3px solid #060273;color:#425a70;">
      ${escapeHtml(inquiry.message)}
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || `"Bestworth" <${process.env.EMAIL_USER}>`,
    to: inquiry.email,
    replyTo: process.env.COMPANY_EMAIL || process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
    subject: 'We received your inquiry - Bestworth Products Limited',
    html: EmailLayout(
      content,
      'We received your inquiry and our team will respond shortly.',
      brandingData
    ),
    attachments: brandingData.attachments
  };

  try {
    return await sendMail(mailOptions, 'inquiry confirmation');
  } catch (error) {
    console.error('[email] error sending inquiry confirmation', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    throw error;
  }
};

const sendAdminReply = async (to, subject, message, cmsData = {}) => {
  console.log('[email] sendAdminReply triggered', {
    to,
    subject: subject || 'Response to your inquiry - Bestworth Products Limited',
    hasBranding: Boolean(cmsData.branding),
    hasContact: Boolean(cmsData.contact),
    hasFooter: Boolean(cmsData.footer),
    messageLength: message.length
  });

  const brandingData = await buildEmailBranding(cmsData);
  const formattedMessage = escapeHtml(message).replace(/\r?\n/g, '<br>');
  const content = `
    <span style="display:block;margin-bottom:9px;color:#D64545;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Official correspondence</span>
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 28px;font-weight:600;color:#102B4C;">Response from Bestworth</h1>
    <div style="font-size: 16px; color: #333; line-height: 1.8;">
      <div style="margin-bottom: 15px;">${formattedMessage}</div>
    </div>
    <div style="height:1px;background:#e3e9f0;margin:28px 0;"></div>
    <div style="font-size: 14px; color: #777;">
      If you have further technical requirements or wish to schedule a physical inspection of our inventory, please reply directly to this email.
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || `"Bestworth Sales" <${process.env.EMAIL_USER}>`,
    to,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
    subject: subject || 'Response to your inquiry - Bestworth Products Limited',
    html: EmailLayout(
      content,
      'Official response from Bestworth Products Limited regarding your inquiry.',
      brandingData
    ),
    attachments: brandingData.attachments
  };

  try {
    return await sendMail(mailOptions, 'admin reply');
  } catch (error) {
    console.error('[email] error sending admin reply', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    throw error;
  }
};

module.exports = {
  sendInquiryNotification,
  sendInquiryConfirmation,
  sendAdminReply,
  sendMail,
  buildEmailBranding,
  EmailLayout,
  escapeHtml,
  buildAppUrl
};
