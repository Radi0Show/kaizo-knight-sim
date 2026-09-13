// Minimal RGBA8 PNG decode/encode on node:zlib. Non-interlaced, 8-bit, colour
// type 6 only — which is every frame UndertaleModTool's sprite export writes.
//
// WHY THIS EXISTS. `tools/pack-sprites.mjs` has to be able to REPAD a frame
// that came out of the extractor trimmed to its inked content (see that file's
// "A FRAME SMALLER THAN ITS SPRITE" note), and this repo has no dependencies
// at all — `node_modules/` does not exist and `npm run verify` must keep
// working on a bare checkout. Forty lines of zlib is cheaper than a dependency
// and cannot rot.
//
// Deliberately narrow: it throws on anything that is not 8-bit RGBA
// non-interlaced rather than half-supporting palettes. If the extractor ever
// starts writing something else, the throw is the right outcome — a silent
// wrong conversion is what this whole lane is cleaning up after.
import { inflateSync, deflateSync } from 'node:zlib';

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

/**
 * Read a PNG's declared pixel size without decoding it. IHDR is fixed at
 * offset 16; this is what a size CHECK wants, and it stays cheap over a
 * thousand frames.
 * @returns {{w: number, h: number}}
 */
export function size(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** @returns {{w: number, h: number, px: Buffer}} RGBA8, row-major. */
export function decode(buf) {
  const { w, h } = size(buf);
  const depth = buf[24];
  const ctype = buf[25];
  const interlace = buf[28];
  if (depth !== 8 || ctype !== 6 || interlace !== 0) {
    throw new Error(`unsupported png: depth ${depth}, colour type ${ctype}, interlace ${interlace}`);
  }
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p];
    p += 1;
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (ft !== 0) throw new Error(`bad png filter ${ft}`);
      cur[x] = v & 0xff;
    }
  }
  return { w, h, px };
}

/** @param {{w: number, h: number, px: Buffer}} img */
export function encode({ w, h, px }) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Compose a trimmed frame onto a transparent `w` x `h` canvas at (ox, oy) —
 * the sprite's own declared box, which is the coordinate system every draw in
 * render/ positions against.
 */
export function pad(img, w, h, ox, oy) {
  if (ox < 0 || oy < 0 || ox + img.w > w || oy + img.h > h) {
    throw new Error(`frame ${img.w}x${img.h} at (${ox},${oy}) does not fit in ${w}x${h}`);
  }
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < img.h; y++) {
    img.px.copy(px, ((y + oy) * w + ox) * 4, y * img.w * 4, (y + 1) * img.w * 4);
  }
  return { w, h, px };
}
