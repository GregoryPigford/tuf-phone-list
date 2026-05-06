import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@tufmeeting.org';
const SITE = 'https://tufmeeting.org';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`)
    return res.status(401).json({ error: 'Unauthorized' });

  const { subject, body, list } = req.body;
  if (!subject?.trim() || !body?.trim())
    return res.status(400).json({ error: 'Subject and body required' });

  // Fetch members with emails
  let query = supabase.from('members').select('name, email, gender').eq('active', true);
  if (list === 'male') query = query.eq('gender', 'male');
  else if (list === 'female') query = query.eq('gender', 'female');

  const { data: members, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const recipients = (members || []).filter(m => m.email);
  if (!recipients.length) return res.status(200).json({ sent: 0, failed: 0 });

  let sent = 0, failed = 0;

  for (const member of recipients) {
    try {
      await resend.emails.send({
        from: `TUF Phone List <${FROM}>`,
        to: member.email,
        subject: subject.trim(),
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
            <div style="background:#1a2d4a;padding:1.5rem 2rem;border-radius:12px 12px 0 0;text-align:center">
              <h1 style="font-family:Georgia,serif;color:white;font-size:1.4rem;margin:0">The Unshakable Foundation</h1>
              <p style="color:rgba(255,255,255,.5);font-size:.8rem;margin:.3rem 0 0">Portland, OR · Est. 2021</p>
            </div>
            <div style="background:#fffdf8;padding:1.75rem 2rem;border:1px solid #ddd5c8;border-top:none;border-radius:0 0 12px 12px">
              <h2 style="font-family:Georgia,serif;color:#1a2d4a;font-size:1.1rem;margin:0 0 1rem">${subject.trim()}</h2>
              <div style="color:#475569;line-height:1.8;white-space:pre-wrap;font-size:.92rem">${body.trim().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
              <hr style="border:none;border-top:1px solid #ddd5c8;margin:1.5rem 0"/>
              <p style="color:#94a3b8;font-size:.78rem;margin:0">
                — The Unshakable Foundation · <a href="${SITE}" style="color:#c96a20">tufmeeting.org</a><br>
                <a href="mailto:theunshakablefoundation@gmail.com" style="color:#c96a20">theunshakablefoundation@gmail.com</a>
              </p>
            </div>
          </div>`
      });
      sent++;
    } catch(e) {
      console.error(`Broadcast failed for ${member.email}:`, e.message);
      failed++;
    }
  }

  return res.status(200).json({ sent, failed, total: recipients.length });
}
