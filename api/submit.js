import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendWelcomeEmail } from './email.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

  if (!name || !phone || !gender)
    return res.status(400).json({ error: 'Name, phone, and gender are required.' });
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin))
    return res.status(400).json({ error: 'A 4-digit PIN is required.' });

  const { data, error } = await supabase.from('members').insert([{
    name, phone,
    email: email || null,
    sobriety_date: sobriety_date || null,
    sponsor_dropdown: sponsor_dropdown || null,
    sponsor_other: sponsor_other || null,
    gender,
    pin_hash: hashPin(pin)
  }]).select();

  if (error) return res.status(500).json({ error: error.message });

  // Send emails (non-blocking)
  try { await sendWelcomeEmail(name, email); } catch(e) { console.error('Welcome email failed:', e.message); }

  return res.status(200).json({ success: true, id: data[0].id });
}
