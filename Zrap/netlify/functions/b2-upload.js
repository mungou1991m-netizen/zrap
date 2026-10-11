// Returns a short-lived B2 upload URL + token for the browser to POST a file to directly.
// Env vars (Netlify → Environment variables, scoped to Functions):
//   B2ApplicationKeyId
//   B2ApplicationKey
//   B2BucketID

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  try {
    const keyId = process.env.B2ApplicationKeyId;
    const appKey = process.env.B2ApplicationKey;
    const bucketId = process.env.B2BucketID;
    if (!keyId || !appKey || !bucketId) {
      return json({ error: 'Missing B2 env vars on Netlify' }, 500, cors);
    }

    const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: `Basic ${basic}` }
    });
    if (!authRes.ok) {
      return json({ error: 'B2 auth failed', detail: await authRes.text() }, 502, cors);
    }
    const auth = await authRes.json();

    const apiUrl = auth.apiInfo && auth.apiInfo.storageApi && auth.apiInfo.storageApi.apiUrl;
    const downloadUrl = auth.apiInfo && auth.apiInfo.storageApi && auth.apiInfo.storageApi.downloadUrl;
    if (!apiUrl || !downloadUrl) {
      return json({ error: 'Unexpected B2 auth response', detail: auth }, 502, cors);
    }

    const upRes = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId })
    });
    if (!upRes.ok) {
      return json({ error: 'get_upload_url failed', detail: await upRes.text() }, 502, cors);
    }
    const up = await upRes.json();

    const bucketsRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: auth.accountId, bucketId })
    });
    const buckets = await bucketsRes.json();
    const bucketName = (buckets.buckets && buckets.buckets[0] && buckets.buckets[0].bucketName) || 'zrap-media';

    return json({
      uploadUrl: up.uploadUrl,
      authorizationToken: up.authorizationToken,
      downloadUrl,
      bucketName
    }, 200, cors);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500, cors);
  }
};

function json(obj, status, cors) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(obj)
  };
}
