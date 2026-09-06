import admin from 'firebase-admin';

const APP_NAME = 'AliMedia';
const FROM_ADDRESS = `${APP_NAME} <noreply@alimedia.dualsyntax.com>`;
// Custom action handler: Firebase sends the user straight to this page with
// ?mode=resetPassword&oobCode=... attached, instead of its own default
// firebaseapp.com page. ResetPasswordScreen (src/components) reads those
// params and completes the reset with our own branded UI.
const ACTION_URL = 'https://alimedia.dualsyntax.com/';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    ),
  });
}

function buildEmailHtml({ appName, email, link }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reset your password</title></head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background-color:#1a1a2e; padding:32px 40px; text-align:center;">
          <span style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">${appName}</span>
        </td></tr>
        <tr><td style="text-align:center; padding:40px 40px 0 40px;">
          <div style="width:64px; height:64px; background-color:#eef1ff; border-radius:50%; margin:0 auto; display:flex; align-items:center; justify-content:center;">
            <table role="presentation" width="64" height="64"><tr><td align="center" valign="middle" style="font-size:28px;">&#128273;</td></tr></table>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px 8px 40px; text-align:center;">
          <h1 style="margin:0; font-size:22px; color:#1a1a2e; font-weight:700;">Reset your password</h1>
        </td></tr>
        <tr><td style="padding:12px 40px 0 40px; text-align:center;">
          <p style="margin:0; font-size:15px; line-height:1.6; color:#555b6e;">
            We received a request to reset the password for your <strong>${appName}</strong> account associated with:
          </p>
          <p style="margin:12px 0 0 0; font-size:15px; font-weight:600; color:#1a1a2e;">${email}</p>
        </td></tr>
        <tr><td style="padding:32px 40px; text-align:center;">
          <a href="${link}" style="background-color:#4f5df7; color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; padding:14px 36px; border-radius:8px; display:inline-block;">
            Reset Password
          </a>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px; text-align:center;">
          <p style="margin:0; font-size:13px; color:#9aa0b4; line-height:1.5;">Button not working? Copy and paste this link into your browser:</p>
          <p style="margin:8px 0 0 0; font-size:13px; word-break:break-all;"><a href="${link}" style="color:#4f5df7; text-decoration:none;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:0 40px;"><hr style="border:none; border-top:1px solid #eceef2; margin:0;"></td></tr>
        <tr><td style="padding:24px 40px 8px 40px; text-align:center;">
          <p style="margin:0; font-size:13px; line-height:1.6; color:#9aa0b4;">If you didn't request a password reset, you can safely ignore this email — your password won't be changed.</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px 40px; text-align:center;">
          <p style="margin:0; font-size:13px; color:#9aa0b4;">Thanks,<br>The ${appName} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Vercel Serverless Function (free on Hobby plan — no Firebase Blaze needed).
 * Replaces the Firebase Cloud Function approach: generates the real Firebase
 * password reset link via the Admin SDK (a free operation regardless of
 * Firebase's billing plan — only Cloud *Functions* itself required Blaze),
 * then emails it through Resend using our own branded HTML instead of
 * Firebase's fixed plain-text template.
 *
 * Called from the frontend as POST /api/send-password-reset.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = (req.body && req.body.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  let link;
  try {
    link = await admin.auth().generatePasswordResetLink(email, {
      url: ACTION_URL,
      handleCodeInApp: true,
    });
  } catch (err) {
    // user-not-found, invalid-email, etc. — report generic success so we
    // don't reveal whether the email is registered (same behavior
    // sendPasswordResetEmail has).
    console.warn('generatePasswordResetLink failed:', err.code || err.message);
    return res.status(200).json({ success: true });
  }

  const html = buildEmailHtml({ appName: APP_NAME, email, link });

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: email,
        subject: `Reset your ${APP_NAME} password`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text().catch(() => '');
      console.error('Resend send failed:', resendRes.status, errText);
      return res.status(500).json({ error: 'Failed to send reset email.' });
    }
  } catch (err) {
    console.error('Resend request error:', err);
    return res.status(500).json({ error: 'Failed to send reset email.' });
  }

  return res.status(200).json({ success: true });
}
