// Company / school logos: any image (PNG, JPG, SVG, WebP, GIF…) is shrunk to a small
// picture saved inside the resume, so it loads instantly and prints in the PDF.
const MAX = 160; // pixels on the longest side — sharp at print size, tiny to store
const OK_EXT = /\.(png|jpe?g|svg|webp|gif|bmp|avif|ico|tiff?)$/i;

export async function readLogo(file) {
  if (!file) throw new Error('No file chosen.');
  if (!(file.type || '').startsWith('image/') && !OK_EXT.test(file.name || '')) {
    throw new Error('Please choose an image — PNG, JPG, SVG or WebP.');
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is too large (over 15 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name || '');
    const w0 = img.naturalWidth || 256;
    const h0 = img.naturalHeight || 256;
    // SVGs are drawn at full size so they stay crisp; photos are only ever shrunk.
    const scale = isSvg ? MAX / Math.max(w0, h0) : Math.min(1, MAX / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    let out = c.toDataURL('image/png');
    if (out.length > 60000) {
      const webp = c.toDataURL('image/webp', 0.88);
      if (webp.startsWith('data:image/webp') && webp.length < out.length) out = webp;
    }
    return out;
  } catch {
    throw new Error('Couldn’t read that image. Try a PNG, JPG or SVG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Two letters to show when there's no logo, e.g. "Kite Payments" → "KP".
export const initialsOf = (name) => (name || '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0].toUpperCase())
  .join('');
