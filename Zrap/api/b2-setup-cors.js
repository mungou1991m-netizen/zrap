// One-shot: writes the correct CORS rule to the B2 bucket so the browser can upload directly.
// Visit https://<your-vercel-domain>/api/b2-setup-cors?origin=https://<your-vercel-domain>
// (pass your production domain as the origin query param).
// Returns {"ok": true, "corsRules": [...]} on success.

export default async function handler(req, res) {
  try {
    const origin = (req.query?.origin) || `https://${req.headers.host}`;
    const keyId = process.env.B2ApplicationKeyId;
    const appKey = process.env.B2ApplicationKey;
    const bucketId = process.env.B2BucketID;
    if (!keyId || !appKey || !bucketId) {
      res.status(500).json({ error: 'Missing B2 env vars' });
      return;
    }

    const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` }
    });
    if (!authRes.ok) { res.status(502).json({ error: 'auth failed', detail: await authRes.text() }); return; }
    const auth = await authRes.json();
    const apiUrl = auth.apiInfo.storageApi.apiUrl;

    const corsRules = [
      {
        corsRuleName: 'zrapAll',
        allowedOrigins: [origin],
        allowedOperations: [
          'b2_upload_file',
          'b2_upload_part',
          'b2_download_file_by_name',
          'b2_download_file_by_id'
        ],
        allowedHeaders: ['*'],
        exposeHeaders: ['x-bz-content-sha1', 'x-bz-file-name', 'x-bz-file-id'],
        maxAgeSeconds: 3600
      }
    ];

    const updateRes = await fetch(`${apiUrl}/b2api/v3/b2_update_bucket`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketId, corsRules })
    });
    const result = await updateRes.json();
    if (!updateRes.ok) { res.status(502).json({ error: 'update_bucket failed', detail: result }); return; }

    res.status(200).json({ ok: true, origin, corsRules: result.corsRules });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
