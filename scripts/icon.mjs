import { deflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

// Original geometric pitch-and-ball artwork, generated locally with no copied assets.
export function createIcon() {
  const width = 80;
  const pixels = Buffer.alloc((width * 3 + 1) * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const dx = x - 40, dy = y - 40;
    let color = y < 40 ? [21, 36, 59] : [26, 83, 69];
    if (x === 8 || x === 71 || y === 8 || y === 71) color = [77, 184, 255];
    if (dx * dx + dy * dy < 23 * 23) color = [240, 245, 250];
    if (Math.abs(dx) + Math.abs(dy) < 11) color = [21, 36, 59];
    if (dx * dx + dy * dy < 23 * 23 && (Math.abs(dx) > 19 || Math.abs(dy) > 19)) color = [77, 184, 255];
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = color[channel];
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(width, 4);
  header[8] = 8; header[9] = 2; // 8-bit RGB; each scanline uses filter 0.
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
