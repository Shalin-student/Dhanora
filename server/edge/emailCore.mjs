function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  replyTo,
  env = {},
}) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey || !to) {
    return { sent: false, reason: apiKey ? 'missing_recipient' : 'not_configured' };
  }

  const from = env.EMAIL_FROM || 'Dhanora (ધનોરા) <onboarding@resend.dev>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [String(to).trim()],
        subject: String(subject),
        html: String(html),
        ...(replyTo ? { reply_to: String(replyTo).trim() } : {}),
      }),
    });
    if (!res.ok) {
      return { sent: false, reason: `http_${res.status}` };
    }
    const data = await res.json();
    return { sent: true, id: data?.id };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}

export function buildPasswordResetEmail({ name, resetUrl }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'Reset your Dhanora (ધનોરા) password',
    html: `
      <div style="font-family:'Plus Jakarta Sans','Noto Sans Gujarati',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#131b2e;background:#faf8ff;">
        <h2 style="margin:0 0 12px;color:#003527;">Dhanora (ધનોરા) Password Reset</h2>
        <p style="font-size:14px;line-height:1.6;">Hi ${safeName},</p>
        <p style="font-size:14px;line-height:1.6;">We received a request to reset your Dhanora (ધનોરા) household account password. This link expires in <strong>30 minutes</strong> and can only be used once.</p>
        <p style="margin:24px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#064E3B;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;">Reset Password</a>
        </p>
        <p style="font-size:12px;color:#404944;word-break:break-all;">Or copy this link: ${safeUrl}</p>
        <p style="font-size:12px;color:#404944;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  };
}

export function buildInviteEmail({ householdName, role, inviteUrl }) {
  const safeHh = escapeHtml(householdName || 'Household');
  const safeRole = escapeHtml(role || 'partner');
  const safeUrl = escapeHtml(inviteUrl);
  return {
    subject: `You are invited to join ${householdName || 'a household'} on Dhanora (ધનોરા)`,
    html: `
      <div style="font-family:'Plus Jakarta Sans','Noto Sans Gujarati',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#131b2e;background:#faf8ff;">
        <h2 style="margin:0 0 12px;color:#003527;">Join ${safeHh} on Dhanora (ધનોરા)</h2>
        <p style="font-size:14px;line-height:1.6;">You have been invited as a <strong>${safeRole}</strong>. Your role permissions are pre-configured automatically via this single-use 72-hour invite link.</p>
        <p style="margin:24px 0;">
          <a href="${safeUrl}" style="display:inline-block;background:#064E3B;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px;">Accept Invite & Join</a>
        </p>
        <p style="font-size:12px;color:#404944;word-break:break-all;">Invite link: ${safeUrl}</p>
      </div>
    `,
  };
}

export function buildReceiptEmail({ householdName, planName, billingCycle, amountDisplay, paymentId }) {
  return {
    subject: `Dhanora (ધનોરા) Receipt: ${planName} (${billingCycle})`,
    html: `
      <div style="font-family:'Plus Jakarta Sans','Noto Sans Gujarati',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#131b2e;background:#faf8ff;">
        <h2 style="margin:0 0 12px;color:#003527;">Payment Confirmed ✓</h2>
        <p style="font-size:14px;line-height:1.6;">Thank you for upgrading <strong>${escapeHtml(householdName)}</strong> to <strong>${escapeHtml(planName)}</strong> (${escapeHtml(billingCycle)}) on Dhanora (ધનોરા).</p>
        <div style="background:#ffffff;border:1px solid #bfc9c3;border-radius:12px;padding:16px;margin:16px 0;font-size:13px;">
          <div><strong>Amount Paid:</strong> ${escapeHtml(amountDisplay)}</div>
          <div><strong>Payment ID:</strong> ${escapeHtml(paymentId || 'Verified')}</div>
        </div>
        <p style="font-size:12px;color:#404944;">Need help or a 7-day refund? Reply or email shalinpatel1102@gmail.com.</p>
      </div>
    `,
  };
}

export function buildFeedbackAlertEmail({ userName, userEmail, category, message, pageView }) {
  return {
    subject: `[Dhanora (ધનોરા) Feedback] ${category}: ${userName || userEmail || 'User'}`,
    html: `
      <div style="font-family:'Plus Jakarta Sans','Noto Sans Gujarati',Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#131b2e;background:#faf8ff;">
        <h3 style="margin:0 0 12px;color:#003527;">New Dhanora (ધનોરા) User Feedback</h3>
        <div style="font-size:13px;line-height:1.6;background:#ffffff;border:1px solid #bfc9c3;border-radius:12px;padding:16px;">
          <div><strong>From:</strong> ${escapeHtml(userName)} (${escapeHtml(userEmail)})</div>
          <div><strong>Category:</strong> ${escapeHtml(category)}</div>
          <div><strong>Active View:</strong> ${escapeHtml(pageView || 'unknown')}</div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;" />
          <div style="white-space:pre-wrap;">${escapeHtml(message)}</div>
        </div>
      </div>
    `,
  };
}
