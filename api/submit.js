import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender } = req.body;

  if (!name || !phone || !gender) {
    return res.status(400).json({ error: 'Name, phone, and gender are required.' });
  }

  const { error } = await supabase.from('members').insert([{
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || null,
    sobriety_date: sobriety_date || null,
    sponsor_dropdown: sponsor_dropdown || null,
    sponsor_other: sponsor_other?.trim() || null,
    gender
  }]);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to save. Please try again.' });
  }

  return res.status(200).json({ success: true });
}
