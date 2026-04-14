import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@tufmeeting.org';

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'tuf2021salt').digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender, pin } = req.body;

  if (!name || !phone || !gender) {
    return res.status(400).json({ error: 'Name, phone, and gender are required.' });
  }
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'A 4-digit PIN is required.' });
  }

  const pin_hash = hashPin(pin);

  const { data, error } = await supabase.from('members').insert([{
    name, phone,
    email: email || null,
    sobriety_date: sobriety_date || null,
    sponsor_dropdown: sponsor_dropdown || null,
    sponsor_other: sponsor_other || null,
    gender,
    pin_hash
  }]).select();

  if (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ error: error.message });
  }

  // Send welcome email if they provided one
  if (email) {
    try {
      await resend.emails.send({
        from: `TUF Phone List <${FROM}>`,
        to: email,
        subject: 'Welcome to The Unshakable Foundation',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:0">
            <!-- Header -->
            <div style="background:#1a2d4a;padding:2rem;border-radius:12px 12px 0 0;text-align:center">
              <h1 style="font-family:Georgia,serif;color:white;font-size:1.6rem;margin:0;font-weight:700">The Unshakable Foundation</h1>
              <p style="color:rgba(255,255,255,.6);font-size:.85rem;margin:.4rem 0 0">Portland, OR · Est. 2021</p>
            </div>
            <!-- Body -->
            <div style="background:#fffdf8;padding:2rem;border:1px solid #ddd5c8;border-top:none;border-radius:0 0 12px 12px">
              <h2 style="font-family:Georgia,serif;color:#1a2d4a;font-size:1.3rem;margin:0 0 .75rem">Welcome, ${name}!</h2>
              <p style="color:#475569;line-height:1.75;margin:0 0 1.25rem">
                You've been added to the TUF phone list. We're really glad you're here.
              </p>

              <!-- Meeting info -->
              <div style="background:#f2f0eb;border-radius:8px;padding:1.25rem;margin-bottom:1.25rem">
                <div style="font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:.6rem">Join Us Tonight</div>
                <p style="color:#1a2d4a;font-weight:700;font-size:1rem;margin:0 0 .25rem">📹 Every night at 10pm Pacific</p>
                <p style="color:#475569;font-size:.88rem;margin:0 0 .75rem">Meeting ID: 806 258 4353</p>
                <a href="https://us02web.zoom.us/j/8062584353" style="display:inline-block;background:#c96a20;color:white;text-decoration:none;padding:10px 22px;border-radius:999px;font-weight:700;font-size:.9rem">Join on Zoom</a>
              </div>

              <!-- PIN reminder -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:1rem;margin-bottom:1.25rem">
                <p style="color:#1e40af;font-size:.85rem;line-height:1.65;margin:0">
                  🔑 <strong>Remember your PIN.</strong> You created a 4-digit PIN when you joined — you'll need it to update or remove your listing. Keep it somewhere safe.
                </p>
              </div>

              <!-- Whitelist note -->
              <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:1rem;margin-bottom:1.25rem">
                <p style="color:#14532d;font-size:.82rem;line-height:1.65;margin:0">
                  📬 To make sure you receive future emails from us, add <strong>noreply@tufmeeting.org</strong> to your contacts.
                </p>
              </div>

              <p style="color:#475569;line-height:1.75;margin:0 0 .5rem">
                You can access the full phone list, find a sponsor, and more at:
              </p>
              <a href="https://tufmeeting.org" style="color:#c96a20;font-weight:700">tufmeeting.org</a>

              <hr style="border:none;border-top:1px solid #ddd5c8;margin:1.5rem 0"/>

              <p style="color:#94a3b8;font-size:.78rem;line-height:1.6;margin:0">
                Questions? Email us at <a href="mailto:theunshakablefoundation@gmail.com" style="color:#c96a20">theunshakablefoundation@gmail.com</a><br>
                — The Unshakable Foundation
              </p>
            </div>
          </div>
        `
      });
    } catch(e) {
      console.error('Welcome email failed:', e.message);
      // Don't fail the submission if email fails
    }
  }

  return res.status(200).json({ success: true, id: data[0].id });
}
