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
      requireTLS: !smtpSecure,
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
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    };

const transporter = nodemailer.createTransport(mailConfig);

const EmailLayout = (content, previewText, cmsData = {}) => {
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
            <img src="${logoUrl}" alt="Bestworth Products Limited" style="height: 40px; width: auto; filter: brightness(0) invert(1);">
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

const sendInquiryNotification = async (inquiry, cmsData = {}) => {
  const appUrl = buildAppUrl();
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
    from: process.env.EMAIL_FROM || `"Bestworth System" <${process.env.EMAIL_USER}>`,
    to: process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
    replyTo: inquiry.email,
    subject: `[Lead] New Inquiry from ${inquiry.company || inquiry.name}`,
    html: EmailLayout(
      content,
      `New inquiry received from ${inquiry.name} representing ${inquiry.company || 'Private'}`,
      cmsData
    )
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Inquiry notification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending inquiry notification:', error);
    throw error;
  }
};

const sendAdminReply = async (to, subject, message, cmsData = {}) => {
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
    from: process.env.EMAIL_FROM || `"Bestworth Sales" <${process.env.EMAIL_USER}>`,
    to,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER,
    subject: subject || 'Response to your inquiry - Bestworth Products Limited',
    html: EmailLayout(
      content,
      'Official response from Bestworth Products Limited regarding your inquiry.',
      cmsData
    )
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Admin reply email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending admin reply:', error);
    throw error;
  }
};

module.exports = {
  sendInquiryNotification,
  sendAdminReply
};
