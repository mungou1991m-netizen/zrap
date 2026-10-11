// One-shot: sets the correct CORS rules on the B2 bucket.
// Visit https://zrapmusic.netlify.app/.netlify/functions/b2-setup-cors once in the browser.
// After it returns {"ok": true}, you can delete this file (or leave it — it's harmless).

exports.handler = async () => {
  try {
    const keyId = process.env.B2ApplicationKeyId;
    const appKey = process.env.B2ApplicationKey;
    const bucketId = process.env.B2BucketID;
    if (!keyId || !appKey || !bucketId) {
      return json({ error: 'Missing B2 env vars' }, 500);
    }

    const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` }
    });
    if (!authRes.ok) return json({ error: 'auth failed', detail: await authRes.text() }, 502);
    const auth = await authRes.json();
    const apiUrl = auth.apiInfo.storageApi.apiUrl;

    const corsRules = [
      {
        corsRuleName: 'zrapAll',
        allowedOrigins: ['https://zrapmusic.netlify.app'],
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
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: auth.accountId,
        bucketId,
        corsRules
      })
    });
    const result = await updateRes.json();
    if (!updateRes.ok) return json({ error: 'update_bucket failed', detail: result }, 502);

    return json({ ok: true, corsRules: result.corsRules });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
};

function json(obj, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj, null, 2)
  };
}
