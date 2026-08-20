const { sendMail, buildEmailBranding, EmailLayout, escapeHtml, buildAppUrl } = require('./email');

function formatDate(value) {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos'
  }).format(new Date(value || Date.now()));
}

function safeAbsoluteUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${buildAppUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function sendNewsArticle({ post, subscriber, cmsData = {}, brandingData, subject, previewText, isTest = false }) {
  if (!post || post.type !== 'news' || post.status !== 'published') {
    throw new Error('Only published news articles can be emailed.');
  }

  const branding = brandingData || await buildEmailBranding(cmsData);
  const articleUrl = `${buildAppUrl()}/news-media/${encodeURIComponent(post.slug)}`;
  const unsubscribeToken = String(subscriber.unsubscribeToken || '');
  const unsubscribeUrl = isTest
    ? `${buildAppUrl()}/newsletter/unsubscribe`
    : `${buildAppUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const oneClickUrl = `${buildAppUrl()}/api/newsletter/unsubscribe/one-click?token=${encodeURIComponent(unsubscribeToken)}`;
  const coverUrl = safeAbsoluteUrl(post.coverImage);
  const emailSubject = String(subject || `${post.title} | Bestworth News`).trim().slice(0, 200);
  const inboxPreview = String(previewText || post.excerpt).trim().slice(0, 300);

  const content = `
    ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="" width="552" style="display:block;width:100%;height:auto;max-height:310px;object-fit:cover;border-radius:7px;margin:0 0 28px;">` : ''}
    <div style="margin-bottom:12px;color:#D64545;font-size:10px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;">Company news&nbsp;&nbsp;·&nbsp;&nbsp;${escapeHtml(formatDate(post.publishedAt))}</div>
    <h1 style="margin:0 0 16px;color:#102B4C;font-size:25px;line-height:1.25;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(post.title)}</h1>
    <p style="margin:0;color:#425a70;font-size:15px;line-height:1.75;">${escapeHtml(post.excerpt)}</p>
    <div style="margin-top:28px;"><a href="${articleUrl}" style="display:inline-block;padding:12px 20px;border-radius:5px;background:#060273;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.5px;">Read full article</a></div>
  `;
  const footerExtra = isTest
    ? '<span style="color:#60758b;">This is a private test email. No subscribers received it.</span>'
    : `You received this email because you subscribed to Bestworth company news. <a href="${unsubscribeUrl}" style="color:#060273;text-decoration:underline;">Unsubscribe</a>.`;
  const text = `${post.title}\n\n${post.excerpt}\n\nRead the full article: ${articleUrl}\n\n${isTest ? 'This is a private test email.' : `Unsubscribe: ${unsubscribeUrl}`}`;

  return sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: subscriber.email,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.COMPANY_EMAIL || process.env.EMAIL_USER,
    subject: emailSubject,
    text,
    html: EmailLayout(content, inboxPreview, branding, { footerExtra }),
    headers: isTest || !unsubscribeToken ? undefined : {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    },
    attachments: branding.attachments
  }, isTest ? 'newsletter test' : 'newsletter article');
}

module.exports = { sendNewsArticle };
