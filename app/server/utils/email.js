const nodemailer = require('nodemailer');
const { toAbsoluteUrl } = require('./public-url');

function buildAppUrl() {
  return (process.env.PUBLIC_APP_URL || 'https://bestworth.onrender.com').replace(/\/$/, '');
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
  const brandColor = '#C5A059';
  const charcoal = '#1A1A1A';
  const lightBg = '#F8F8F5';
  const appUrl = buildAppUrl();
  const requestLike = makePseudoRequest(appUrl);

  const contact = cmsData.contact || {};
  const footerData = cmsData.footer || {};
  const branding = cmsData.branding || {};

  const address = contact.address || 'Plot 15, Industrial Estate, Phase II, Lagos, Nigeria';
  const regNo = footerData.registrationNumber || 'RC: 1191234';
  const website = appUrl;
  const linkedin = footerData.socials?.linkedin || 'https://linkedin.com/company/bestworth';
  const twitter = footerData.socials?.twitter || 'https://twitter.com/bestworth';

  const logoUrl = toAbsoluteUrl(requestLike, branding.logoUrl || '/assets/Closed Sidebar Logo.jpg');
  const faviconUrl = toAbsoluteUrl(requestLike, branding.faviconUrl || '/assets/Favicon Logo.png');
  const logoAttachment = await fetchAssetAsAttachment(logoUrl, 'bestworth-logo', 'bestworth-logo');

  return {
    brandColor,
    charcoal,
    lightBg,
    address,
    regNo,
    website,
    linkedin,
    twitter,
    logoUrl,
    faviconUrl,
    logoSrc: logoAttachment ? 'cid:bestworth-logo' : logoUrl,
    attachments: logoAttachment ? [logoAttachment] : []
  };
}

const EmailLayout = (content, previewText, brandingData) => {
  const {
    brandColor,
    charcoal,
    lightBg,
    address,
    regNo,
    website,
    linkedin,
    twitter,
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
      <style>
        body { margin: 0; padding: 0; background-color: ${lightBg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { padding: 40px; text-align: center; background-color: ${charcoal}; border-bottom: 4px solid ${brandColor}; }
        .content { padding: 50px 40px; color: ${charcoal}; line-height: 1.6; }
        .footer { padding: 40px; background-color: ${charcoal}; color: #ffffff; text-align: center; font-size: 11px; letter-spacing: 1px; }
        .footer a { color: ${brandColor}; text-decoration: none; font-weight: bold; }
        .button { display: inline-block; padding: 14px 30px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-size: 10px; margin-top: 20px; }
        .divider { height: 1px; background-color: #eeeeee; margin: 30px 0; }
        .label { font-size: 10px; font-weight: bold; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
        ${previewText}
      </div>
      <div class="container">
        <div class="header">
          <div style="margin-bottom: 20px;">
            <img src="${logoSrc}" alt="Bestworth Products Limited" style="height: 40px; width: auto; filter: brightness(0) invert(1);">
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <img src="${faviconUrl}" style="height: 12px; width: 12px; display: inline-block;" alt="">
            <div style="color: ${brandColor}; font-size: 8px; letter-spacing: 4px; font-weight: bold; text-transform: uppercase; display: inline-block;">
              Industrial Excellence
            </div>
          </div>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <div style="font-size: 14px; margin-bottom: 20px; letter-spacing: 2px;">BESTWORTH PRODUCTS LIMITED</div>
          <p style="opacity: 0.6; line-height: 1.8;">
            ${address}<br>
            ${regNo} • Established 1998
          </p>
          <div class="divider" style="background-color: rgba(255,255,255,0.1);"></div>
          <p style="opacity: 0.8;">
            <a href="${website}">WEBSITE</a> &nbsp;•&nbsp;
            <a href="${linkedin}">LINKEDIN</a> &nbsp;•&nbsp;
            <a href="${twitter}">TWITTER</a>
          </p>
          <p style="margin-top: 30px; opacity: 0.4; font-size: 9px;">
            &copy; ${new Date().getFullYear()} Bestworth Products Limited. All Rights Reserved.
          </p>
        </div>
      </div>
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
      html: mailOptions.html,
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
          to: (Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]).map((email) => ({ email }))
        }
      ],
      from: {
        email: mailOptions.from
      },
      reply_to: mailOptions.replyTo ? { email: mailOptions.replyTo } : undefined,
      subject: mailOptions.subject,
      content: [
        {
          type: 'text/html',
          value: mailOptions.html
        }
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
  console.log('[email] sendInquiryNotification triggered', {
    inquiryId: String(inquiry._id),
    to: process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
    replyTo: inquiry.email,
    hasBranding: Boolean(cmsData.branding),
    hasContact: Boolean(cmsData.contact),
    hasFooter: Boolean(cmsData.footer)
  });

  const appUrl = buildAppUrl();
  const brandingData = await buildEmailBranding(cmsData);
  const content = `
    <span class="label">System Notification</span>
    <h1 style="font-size: 24px; margin: 0 0 30px 0; font-weight: 500; letter-spacing: -0.5px;">New Business Inquiry</h1>
    <div style="margin-bottom: 25px;">
      <span class="label">From</span>
      <div style="font-size: 16px; font-weight: bold;">${inquiry.name}</div>
      <div style="font-size: 14px; opacity: 0.7;">${inquiry.email}</div>
    </div>
    <div style="margin-bottom: 25px;">
      <span class="label">Company</span>
      <div style="font-size: 16px;">${inquiry.company || 'Not Specified'}</div>
    </div>
    <div class="divider"></div>
    <span class="label">Message Context</span>
    <div style="background-color: #F8F8F5; padding: 25px; border-left: 2px solid #C5A059; font-style: italic; color: #444;">
      "${inquiry.message}"
    </div>
    <div style="margin-top: 40px;">
      <a href="${appUrl}/admin" class="button">Access Admin Portal</a>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || `"Bestworth System" <${process.env.EMAIL_USER}>`,
    to: process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
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
    <span class="label">Inquiry Received</span>
    <h1 style="font-size: 24px; margin: 0 0 30px 0; font-weight: 500; letter-spacing: -0.5px;">Thank You for Contacting Bestworth</h1>
    <div style="font-size: 16px; color: #333; line-height: 1.8;">
      <div style="margin-bottom: 15px;">Dear ${inquiry.name},</div>
      <div style="margin-bottom: 15px;">We have received your inquiry and our team will review it shortly.</div>
      <div style="margin-bottom: 15px;">A member of our team will get back to you using this email address as soon as possible.</div>
    </div>
    <div class="divider"></div>
    <span class="label">Your Message</span>
    <div style="background-color: #F8F8F5; padding: 25px; border-left: 2px solid #C5A059; font-style: italic; color: #444;">
      "${inquiry.message}"
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
  const formattedMessage = message.replace(/<br>/g, '</div><div style="margin-bottom: 15px;">');
  const content = `
    <span class="label">Official Correspondence</span>
    <h1 style="font-size: 24px; margin: 0 0 35px 0; font-weight: 500; letter-spacing: -0.5px;">Corporate Response</h1>
    <div style="font-size: 16px; color: #333; line-height: 1.8;">
      <div style="margin-bottom: 15px;">${formattedMessage}</div>
    </div>
    <div class="divider"></div>
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
  sendAdminReply
};
