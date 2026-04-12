import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin + 'tuf2021salt').digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const auth = req.headers.authorization || '';
  const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;

  // GET - look up member by name for PIN entry screen
  if (req.method === 'GET') {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase
      .from('members')
      .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender')
      .ilike('name', `%${name}%`);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // Verify PIN for public requests
  async function verifyPin(memberId, pin) {
    if (!pin) return false;
    const { data } = await supabase
      .from('members')
      .select('pin_hash')
      .eq('id', memberId)
      .single();
    if (!data || !data.pin_hash) return false;
    return data.pin_hash === hashPin(pin);
  }

  // PUT - update member
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'ID required' });

    if (!isAdmin) {
      const pin = req.body.pin;
      const valid = await verifyPin(id, pin);
      if (!valid) return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }

    const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, pin: newPin } = req.body;
    const updates = { name, phone, email: email || null, sobriety_date: sobriety_date || null, sponsor_dropdown: sponsor_dropdown || null, sponsor_other: sponsor_other || null };

    // Allow PIN change
    if (newPin && /^\d{4}$/.test(newPin)) {
      updates.pin_hash = hashPin(newPin);
    }

    const { error } = await supabase.from('members').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // DELETE - remove member
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'ID required' });

    if (!isAdmin) {
      const pin = req.query.pin || req.body?.pin;
      const valid = await verifyPin(id, pin);
      if (!valid) return res.status(401).json({ error: 'Incorrect PIN. Please try again.' });
    }

    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
