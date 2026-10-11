// Vercel serverless function.
// GET /api/b2-upload → returns { uploadUrl, authorizationToken, downloadUrl, bucketName }
// The browser then POSTs the file directly to uploadUrl (CORS must be set on B2).
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   B2ApplicationKeyId
//   B2ApplicationKey
//   B2BucketID

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    const keyId = process.env.B2ApplicationKeyId;
    const appKey = process.env.B2ApplicationKey;
    const bucketId = process.env.B2BucketID;
    if (!keyId || !appKey || !bucketId) {
      res.status(500).json({ error: 'Missing B2 env vars on Vercel' });
      return;
    }

    const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` }
    });
    if (!authRes.ok) {
      res.status(502).json({ error: 'B2 auth failed', detail: await authRes.text() });
      return;
    }
    const auth = await authRes.json();

    const apiUrl = auth.apiInfo?.storageApi?.apiUrl;
    const downloadUrl = auth.apiInfo?.storageApi?.downloadUrl;
    if (!apiUrl || !downloadUrl) {
      res.status(502).json({ error: 'Unexpected B2 auth response', detail: auth });
      return;
    }

    const upRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId })
    });
    if (!upRes.ok) {
      res.status(502).json({ error: 'get_upload_url failed', detail: await upRes.text() });
      return;
    }
    const up = await upRes.json();

    const bucketsRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketId })
    });
    const buckets = await bucketsRes.json();
    const bucketName = buckets.buckets?.[0]?.bucketName || 'zrap-media';

    res.status(200).json({
      uploadUrl: up.uploadUrl,
      authorizationToken: up.authorizationToken,
      downloadUrl,
      bucketName
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
