import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization;
  const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
  const isPublicUpdate = auth === 'Bearer PUBLIC_UPDATE';

  if (req.method === 'DELETE' && !isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method === 'PUT' && !isAdmin && !isPublicUpdate) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID required' });

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender } = req.body;
    const updatePayload = isAdmin
      ? { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other, gender }
      : { name, phone, email, sobriety_date, sponsor_dropdown, sponsor_other };

    const { error } = await supabase.from('members').update(updatePayload).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
