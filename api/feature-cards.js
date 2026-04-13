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

  // GET — public
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('feature_cards')
      .select('id, title, body, font, photo_url, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(200).json({ cards: [] });
    return res.status(200).json({ cards: data || [] });
  }

  // Auth required for write
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // POST — create
  if (req.method === 'POST') {
    const { title, body, font, photo_url, sort_order } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const { error } = await supabase.from('feature_cards').insert([{
      title: title.trim(),
      body: body?.trim() || null,
      font: font || 'cursive',
      photo_url: photo_url || null,
      sort_order: sort_order || 0,
      active: true
    }]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // PUT — update
  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const { title, body, font, photo_url, sort_order, active } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (body !== undefined) updates.body = body?.trim() || null;
    if (font !== undefined) updates.font = font;
    if (photo_url !== undefined) updates.photo_url = photo_url || null;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (active !== undefined) updates.active = active;
    const { error } = await supabase.from('feature_cards').update(updates).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    const { error } = await supabase.from('feature_cards').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
