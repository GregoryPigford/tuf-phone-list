import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { Resend } from 'resend';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'noreply@tufmeeting.org';
const SITE = 'https://tufmeeting.org';
const ADMIN_EMAIL = 'theunshakablefoundation@gmail.com';

function hashPin(pin) { return crypto.createHash('sha256').update(pin + 'tuf2021salt').digest('hex'); }
function normalizePhone(p) { return (p || '').replace(/\D/g, '').slice(-10); }

async function sendPinSetEmail(name, email, pin) {
  if (!email) return;
  await resend.emails.send({
    from: `TUF Phone List <${FROM}>`, to: email,
    subject: 'Your TUF PIN has been set',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
      <h2 style="color:#1a2d4a">Hi ${name},</h2>
      <p style="color:#475569;line-height:1.7">An admin has set a temporary PIN for your TUF listing.</p>
      <div style="background:#f2f0eb;border-radius:8px;padding:1.1rem;text-align:center;margin:1rem 0">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:.4rem">Your Temporary PIN</div>
        <div style="font-family:Georgia,serif;font-size:2.5rem;font-weight:700;color:#1a2d4a;letter-spacing:.3em">${pin}</div>
      </div>
      <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:.9rem;margin-bottom:1rem">
        <p style="color:#92400e;font-size:.83rem;line-height:1.65;margin:0">⚠️ Please update this to something private at <a href="${SITE}" style="color:#c96a20">tufmeeting.org</a> → Me → Update My Info.</p>
      </div>
      <p style="color:#94a3b8;font-size:.78rem">— The Unshakable Foundation</p>
    </div>`
  });
}

async function sendRemovedByUserEmail(name, email) {
  if (!email) return;
  await resend.emails.send({
    from: `TUF Phone List <${FROM}>`, to: email,
    subject: "You've been removed from the TUF phone list",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
      <h2 style="color:#1a2d4a">Hi ${name},</h2>
      <p style="color:#475569;line-height:1.7">Your entry has been removed from the TUF phone list as requested.</p>
      <p style="color:#475569;line-height:1.7">If this was a mistake or you'd like to rejoin, visit <a href="${SITE}" style="color:#c96a20">tufmeeting.org</a>.</p>
      <p style="color:#94a3b8;font-size:.78rem">— The Unshakable Foundation</p>
    </div>`
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const auth = req.headers.authorization || '';
  const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;

  if (req.method === 'GET') {
    const { name } = req.query;
    if (name) {
      const { data, error } = await supabase.from('members')
        .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender')
        .ilike('name', `%${name}%`);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }
    const { data, error } = await supabase.from('members')
      .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'ID required' });
    const body = req.body || {};

    if (isAdmin) {
      const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other,
              newPin, last_renewed, expiry_warned, active } = body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email || null;
      if (sobriety_date !== undefined) updates.sobriety_date = sobriety_date || null;
      if (sponsor_dropdown !== undefined) updates.sponsor_dropdown = sponsor_dropdown || null;
      if (sponsor_other !== undefined) updates.sponsor_other = sponsor_other || null;
      if (last_renewed !== undefined) updates.last_renewed = last_renewed;
      if (expiry_warned !== undefined) updates.expiry_warned = expiry_warned;
      if (active !== undefined) updates.active = active;
      if (body._resetPin) {
        // Clear PIN — puts member back into grandfather flow
        const { error } = await supabase.from('members').update({ pin_hash: null }).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      }
      if (newPin && /^\d{4}$/.test(newPin)) {
        updates.pin_hash = hashPin(newPin);
        const { data: member } = await supabase.from('members').select('name, email').eq('id', id).single();
        if (member?.email) try { await sendPinSetEmail(member.name, member.email, newPin); } catch(e) {}
      }
      const { error } = await supabase.from('members').update(updates).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    const { data: member, error: fetchErr } = await supabase.from('members')
      .select('pin_hash, phone').eq('id', id).single();
    if (fetchErr || !member) return res.status(404).json({ error: 'Member not found' });

    if (body._pinCheck) {
      if (!member.pin_hash) return res.status(428).json({ error: 'no_pin' });
      if (member.pin_hash !== hashPin(body.pin || '')) return res.status(401).json({ error: 'Incorrect PIN' });
      return res.status(200).json({ success: true, verified: true });
    }

    if (body._setupPin) {
      if (member.pin_hash) return res.status(401).json({ error: 'PIN already set.' });
      if (normalizePhone(body.phone) !== normalizePhone(member.phone))
        return res.status(401).json({ error: 'Phone number does not match our records.' });
      if (!/^\d{4}$/.test(body.newPin || '')) return res.status(400).json({ error: 'Invalid PIN' });
      const { error } = await supabase.from('members').update({ pin_hash: hashPin(body.newPin) }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    const pin = body.pin || '';
    if (!member.pin_hash) return res.status(428).json({ error: 'no_pin' });
    if (member.pin_hash !== hashPin(pin)) return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });

    const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other,
            newPin, last_renewed, expiry_warned, active } = body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email || null;
    if (sobriety_date !== undefined) updates.sobriety_date = sobriety_date || null;
    if (sponsor_dropdown !== undefined) updates.sponsor_dropdown = sponsor_dropdown || null;
    if (sponsor_other !== undefined) updates.sponsor_other = sponsor_other || null;
    if (last_renewed !== undefined) updates.last_renewed = last_renewed;
    if (expiry_warned !== undefined) updates.expiry_warned = expiry_warned;
    if (active !== undefined) updates.active = active;
    if (newPin && /^\d{4}$/.test(newPin)) updates.pin_hash = hashPin(newPin);

    const { error } = await supabase.from('members').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID required' });

    if (isAdmin) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    const pin = req.query.pin || (req.body && req.body.pin) || '';
    const { data: member, error: fetchErr } = await supabase.from('members')
      .select('pin_hash, name, email').eq('id', id).single();
    if (fetchErr || !member) return res.status(404).json({ error: 'Member not found' });
    if (!member.pin_hash) return res.status(428).json({ error: 'no_pin' });
    if (member.pin_hash !== hashPin(pin)) return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });

    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    try { await sendRemovedByUserEmail(member.name, member.email); } catch(e) {}
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
