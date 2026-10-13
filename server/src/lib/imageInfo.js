// Identifies PNG/JPEG/GIF/WebP by magic bytes and reads dimensions. Never trusts the declared file type.
export function imageInfo(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') return { format: 'png', mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.toString('ascii', 0, 3) === 'GIF') return { format: 'gif', mime: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { format: 'jpeg', mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const t = buf.toString('ascii', 12, 16);
    if (t === 'VP8X') return { format: 'webp', mime: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (t === 'VP8 ') return { format: 'webp', mime: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { format: 'webp', mime: 'image/webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}
