import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;

  // Admin login verification — reject if ?admin=1 but wrong password
  if (req.query.admin === '1' && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const showAll = req.query.all === 'true' && isAdmin;

  let query = supabase
    .from('members')
    .select('id, name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender, last_renewed, expiry_warned, active, created_at, pin_hash')
    .order('name');

  if (!showAll) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  // Strip pin_hash from public responses
  const result = (data || []).map(m => {
    if (!isAdmin) {
      const { pin_hash, ...rest } = m;
      return rest;
    }
    return m;
  });
  return res.status(200).json(result);
}
