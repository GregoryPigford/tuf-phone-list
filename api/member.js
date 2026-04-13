import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'tuf2021salt').digest('hex');
}

function normalizePhone(p) {
  return (p || '').replace(/\D/g, '').slice(-10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const auth = req.headers.authorization || '';
  const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;

  // GET — search members by name
  if (req.method === 'GET') {
    const { name } = req.query;
    if (name) {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender')
        .ilike('name', `%${name}%`);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }
    // Return all (admin or general)
    const { data, error } = await supabase
      .from('members')
      .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender')
      .order('name');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // PUT — update member
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'ID required' });

    const body = req.body || {};

    // Admin bypass
    if (isAdmin) {
      const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, newPin, last_renewed, expiry_warned, active } = body;
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email||null;
      if (sobriety_date !== undefined) updates.sobriety_date = sobriety_date||null;
      if (sponsor_dropdown !== undefined) updates.sponsor_dropdown = sponsor_dropdown||null;
      if (sponsor_other !== undefined) updates.sponsor_other = sponsor_other||null;
      if (last_renewed !== undefined) updates.last_renewed = last_renewed;
      if (expiry_warned !== undefined) updates.expiry_warned = expiry_warned;
      if (active !== undefined) updates.active = active;
      if (newPin && /^\d{4}$/.test(newPin)) updates.pin_hash = hashPin(newPin);
      const { error } = await supabase.from('members').update(updates).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // Fetch member record
    const { data: member, error: fetchErr } = await supabase
      .from('members')
      .select('pin_hash, phone')
      .eq('id', id)
      .single();
    if (fetchErr || !member) return res.status(404).json({ error: 'Member not found' });

    // ── PIN CHECK mode ──
    if (body._pinCheck) {
      if (!member.pin_hash) {
        // No PIN set — grandfather flow needed
        return res.status(428).json({ error: 'no_pin', message: 'No PIN set. Please set one.' });
      }
      const pin = body.pin || '';
      if (member.pin_hash !== hashPin(pin)) {
        return res.status(401).json({ error: 'Incorrect PIN' });
      }
      return res.status(200).json({ success: true, verified: true });
    }

    // ── GRANDFATHER PIN SETUP mode ──
    if (body._setupPin) {
      if (member.pin_hash) {
        // Already has a PIN — don't allow bypass
        return res.status(401).json({ error: 'PIN already set. Please use your existing PIN.' });
      }
      // Verify phone matches
      const submittedPhone = normalizePhone(body.phone);
      const recordPhone = normalizePhone(member.phone);
      if (!submittedPhone || submittedPhone !== recordPhone) {
        return res.status(401).json({ error: 'Phone number does not match our records.' });
      }
      const newPin = body.newPin || '';
      if (!/^\d{4}$/.test(newPin)) return res.status(400).json({ error: 'Invalid PIN' });
      const { error } = await supabase
        .from('members')
        .update({ pin_hash: hashPin(newPin) })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    // ── REGULAR UPDATE ──
    const pin = body.pin || '';
    if (!member.pin_hash) {
      return res.status(428).json({ error: 'no_pin' });
    }
    if (member.pin_hash !== hashPin(pin)) {
      return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }
    const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, newPin } = body;
    const updates = { name, phone, email: email||null, sobriety_date: sobriety_date||null, sponsor_dropdown: sponsor_dropdown||null, sponsor_other: sponsor_other||null };
    if (newPin && /^\d{4}$/.test(newPin)) updates.pin_hash = hashPin(newPin);
    const { error } = await supabase.from('members').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // DELETE — remove member
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID required' });
    if (isAdmin) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
    const pin = req.query.pin || (req.body && req.body.pin) || '';
    const { data: member, error: fetchErr } = await supabase
      .from('members').select('pin_hash').eq('id', id).single();
    if (fetchErr || !member) return res.status(404).json({ error: 'Member not found' });
    if (!member.pin_hash) return res.status(428).json({ error: 'no_pin' });
    if (member.pin_hash !== hashPin(pin)) return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
