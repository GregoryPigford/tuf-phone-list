import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const auth = req.headers.authorization || '';
    const isAdmin = auth === `Bearer ${process.env.ADMIN_PASSWORD}`;
    let query = supabase.from('resources').select('*').order('sort_order');
    if (!isAdmin) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ resources: data || [] });
  }

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`)
    return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { title, description, url, icon, color, sort_order } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const { error } = await supabase.from('resources').insert([{
      title: title.trim(), description: description?.trim()||null,
      url: url?.trim()||null, icon: icon||'🔗', color: color||'#1a4a7a',
      sort_order: sort_order||0, active: true
    }]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const { title, description, url, icon, color, sort_order, active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim()||null;
    if (url !== undefined) updates.url = url?.trim()||null;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (active !== undefined) updates.active = active;
    const { error } = await supabase.from('resources').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const { error } = await supabase.from('resources').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
