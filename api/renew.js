import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send(errorPage('Missing renewal token.'));

  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const [id, secret] = decoded.split(':');
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).send(errorPage('Invalid renewal link.'));
    }

    const { data: member, error } = await supabase
      .from('members')
      .select('id, name')
      .eq('id', id)
      .single();

    if (error || !member) return res.status(404).send(errorPage('Member not found.'));

    await supabase.from('members').update({
      last_renewed: new Date().toISOString(),
      expiry_warned: false,
      active: true
    }).eq('id', id);

    return res.status(200).send(successPage(member.name));
  } catch(e) {
    return res.status(400).send(errorPage('Invalid renewal link.'));
  }
}

function successPage(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Renewed!</title></head>
  <body style="font-family:sans-serif;background:#1a2d4a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem">
    <div style="background:white;border-radius:1.25rem;padding:2.5rem;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
      <div style="font-size:3rem;margin-bottom:1rem">✅</div>
      <h2 style="font-family:Georgia,serif;color:#1a2d4a;margin-bottom:.5rem">You're renewed, ${name}!</h2>
      <p style="color:#475569;line-height:1.7;margin-bottom:1.5rem">Your TUF phone list listing has been renewed for another 6 months. We're glad you're still with us.</p>
      <a href="https://tuf-phone-list.vercel.app" style="display:inline-block;background:#c96a20;color:white;text-decoration:none;padding:10px 24px;border-radius:999px;font-weight:700">Go to TUF</a>
    </div>
  </body></html>`;
}

function errorPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Error</title></head>
  <body style="font-family:sans-serif;background:#1a2d4a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem">
    <div style="background:white;border-radius:1.25rem;padding:2.5rem;max-width:400px;text-align:center">
      <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
      <h2 style="color:#7f1d1d;margin-bottom:.5rem">Something went wrong</h2>
      <p style="color:#475569">${msg}</p>
      <p style="color:#94a3b8;font-size:.82rem;margin-top:1rem">Contact <a href="mailto:theunshakablefoundation@gmail.com" style="color:#c96a20">theunshakablefoundation@gmail.com</a> for help.</p>
    </div>
  </body></html>`;
}
