// Generates PWA icons (solid brand orange with a white "A") without any deps.
// Run: node scripts/gen-icons.js
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ── Minimal PNG encoder ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgbaFn) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = rgbaFn(x, y);
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Drawing ────────────────────────────────────────────────────────────
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function makeIcon(size) {
  const bg = [255, 106, 61]; // #ff6a3d
  const fg = [255, 255, 255];
  // Letter "A": apex, feet, crossbar (relative coords)
  const apex = [0.5, 0.26];
  const lFoot = [0.30, 0.74];
  const rFoot = [0.70, 0.74];
  const barY = 0.585;
  // crossbar endpoints: interpolate along legs at barY
  const tBar = (barY - apex[1]) / (lFoot[1] - apex[1]);
  const lBar = [apex[0] + (lFoot[0] - apex[0]) * tBar, barY];
  const rBar = [apex[0] + (rFoot[0] - apex[0]) * tBar, barY];
  const stroke = 0.052;

  return encodePNG(size, size, (x, y) => {
    const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
    const s = stroke;
    const onA =
      distToSegment(nx, ny, apex[0], apex[1], lFoot[0], lFoot[1]) < s ||
      distToSegment(nx, ny, apex[0], apex[1], rFoot[0], rFoot[1]) < s ||
      distToSegment(nx, ny, lBar[0], lBar[1], rBar[0], rBar[1]) < s;
    const c = onA ? fg : bg;
    return [c[0], c[1], c[2], 255];
  });
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(outDir, name), makeIcon(size));
  console.log(`✓ ${name}`);
}
