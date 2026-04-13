import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { filename, contentType, data } = req.body;
  if (!filename || !contentType || !data) {
    return res.status(400).json({ error: 'filename, contentType, and data required' });
  }

  // data is base64 encoded
  const buffer = Buffer.from(data, 'base64');
  const path = `feature-cards/${Date.now()}-${filename}`;

  const { error } = await supabase.storage
    .from('tuf-photos')
    .upload(path, buffer, { contentType, upsert: false });

  if (error) return res.status(500).json({ error: error.message });

  const { data: urlData } = supabase.storage
    .from('tuf-photos')
    .getPublicUrl(path);

  return res.status(200).json({ url: urlData.publicUrl });
}
