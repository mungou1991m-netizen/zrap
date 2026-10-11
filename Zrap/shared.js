// Shared Firebase config and helpers used across index.html, artists.html, distributors.html

export const firebaseConfig = {
  apiKey: "AIzaSyD14yOD1kKFDXvN9WhvfB0IoC6lIMhmCVs",
  authDomain: "cinefy-9db6e.firebaseapp.com",
  databaseURL: "https://cinefy-9db6e-default-rtdb.firebaseio.com",
  projectId: "cinefy-9db6e",
  storageBucket: "cinefy-9db6e.firebasestorage.app",
  messagingSenderId: "698858771874",
  appId: "1:698858771874:web:428cb1cdedbb697aa5cefb",
  measurementId: "G-FP92XFY368"
};

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

export function humanErr(e) {
  const c = (e && e.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email or password is wrong.';
  if (c.includes('email-already-in-use')) return 'That email is already registered.';
  if (c.includes('weak-password')) return 'Password needs 6+ characters.';
  if (c.includes('invalid-email')) return 'That email looks invalid.';
  if (c.includes('network-request-failed')) return 'Network error. Check your connection.';
  return (e && e.message) || 'Something went wrong.';
}

export async function uploadToB2(file, pathPrefix) {
  const metaRes = await fetch('/api/b2-upload');
  if (!metaRes.ok) throw new Error('Could not reach upload service');
  const meta = await metaRes.json();
  if (meta.error) throw new Error(meta.error);

  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const fileName = `${pathPrefix}/${Date.now()}-${safeName}`;

  const upRes = await fetch(meta.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: meta.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(fileName),
      'Content-Type': file.type || 'b2/x-auto',
      'X-Bz-Content-Sha1': 'do_not_verify'
    },
    body: file
  });
  if (!upRes.ok) throw new Error('B2 upload failed: ' + await upRes.text());
  const result = await upRes.json();
  const encodedName = result.fileName.split('/').map(encodeURIComponent).join('/');
  return `${meta.downloadUrl}/file/${meta.bucketName}/${encodedName}`;
}

export function readAudioDuration(file) {
  return new Promise(resolve => {
    const el = document.createElement('audio');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(Math.round(el.duration) || 0);
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(file);
  });
}
