import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@tufmeeting.org';
const BASE_URL = 'https://tuf-phone-list.vercel.app';

export default async function handler(req, res) {
  // Vercel cron calls with GET, protect with a secret
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const day150 = new Date(now - 150 * 24 * 60 * 60 * 1000); // 150 days ago = 30 day warning
  const day180 = new Date(now - 180 * 24 * 60 * 60 * 1000); // 180 days ago = expired

  // Fetch all active members
  const { data: members, error } = await supabase
    .from('members')
    .select('id, name, email, last_renewed, expiry_warned')
    .eq('active', true);

  if (error) return res.status(500).json({ error: error.message });

  const warned = [], expired = [], noEmail = [];

  for (const m of members) {
    const renewed = new Date(m.last_renewed);

    // Expired — 180+ days
    if (renewed < day180) {
      await supabase.from('members').update({ active: false }).eq('id', m.id);
      expired.push(m.name);
      continue;
    }

    // Warn — 150-179 days, not yet warned
    if (renewed < day150 && !m.expiry_warned) {
      if (m.email) {
        // Generate renewal token (simple hash of id + secret)
        const token = Buffer.from(`${m.id}:${process.env.CRON_SECRET}`).toString('base64url');
        const renewUrl = `${BASE_URL}/api/renew?token=${token}`;

        try {
          await resend.emails.send({
            from: `TUF Phone List <${FROM}>`,
            to: m.email,
            subject: 'Your TUF phone list listing expires in 30 days',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
                <h2 style="color:#1a2d4a;margin-bottom:.5rem">Hi ${m.name},</h2>
                <p style="color:#475569;line-height:1.7;margin-bottom:1rem">
                  Your listing on the TUF phone list will expire in <strong>30 days</strong>.
                  To stay on the list, just click the button below — it takes one second.
                </p>
                <a href="${renewUrl}" style="display:inline-block;background:#c96a20;color:white;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:700;font-size:1rem;margin-bottom:1.5rem">
                  Renew My Listing
                </a>
                <p style="color:#94a3b8;font-size:.82rem;line-height:1.6">
                  If you no longer wish to be on the list, you can ignore this email and your entry will be removed automatically after 30 days.<br><br>
                  — The Unshakable Foundation<br>
                  <a href="mailto:theunshakablefoundation@gmail.com" style="color:#c96a20">theunshakablefoundation@gmail.com</a>
                </p>
              </div>
            `
          });
          await supabase.from('members').update({ expiry_warned: true }).eq('id', m.id);
          warned.push(m.name);
        } catch(e) {
          console.error('Email failed for', m.name, e.message);
        }
      } else {
        // No email — flag for admin
        await supabase.from('members').update({ expiry_warned: true }).eq('id', m.id);
        noEmail.push(m.name);
      }
    }
  }

  return res.status(200).json({
    success: true,
    warned: warned.length,
    expired: expired.length,
    noEmail: noEmail.length,
    details: { warned, expired, noEmail }
  });
}
