/**
 * WebM (Opus) → OGG Opus remuxer.
 * Pure TypeScript — no external dependencies, no Wasm.
 * Extracts raw Opus frames from a WebM container and wraps them
 * in a valid OGG Opus stream that the Agreggar API accepts.
 */

// ─── OGG CRC-32 (polynomial 0x04C11DB7, direct algorithm) ───────────
const CRC_TABLE = new Uint32Array(256);
(() => {
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? ((r << 1) ^ 0x04C11DB7) : r << 1;
    }
    CRC_TABLE[i] = r >>> 0;
  }
})();

function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ b) & 0xFF]) >>> 0;
  }
  return crc;
}

// ─── OGG page builder ────────────────────────────────────────────────
function buildOggPage(
  headerType: number,
  granulePosition: bigint,
  serialNumber: number,
  pageSequence: number,
  packets: Uint8Array[],
): Uint8Array {
  // Build segment table: each packet is split into 255-byte chunks + remainder
  const segTable: number[] = [];
  for (const pkt of packets) {
    let rem = pkt.length;
    while (rem >= 255) { segTable.push(255); rem -= 255; }
    segTable.push(rem);
  }

  const totalData = packets.reduce((s, p) => s + p.length, 0);
  const headerSize = 27 + segTable.length;
  const page = new Uint8Array(headerSize + totalData);
  const dv = new DataView(page.buffer);

  // "OggS"
  page.set([0x4F, 0x67, 0x67, 0x53], 0);
  page[4] = 0;              // version
  page[5] = headerType;     // flags
  dv.setBigInt64(6, granulePosition, true);
  dv.setUint32(14, serialNumber, true);
  dv.setUint32(18, pageSequence, true);
  dv.setUint32(22, 0, true); // CRC placeholder
  page[26] = segTable.length;

  for (let i = 0; i < segTable.length; i++) page[27 + i] = segTable[i];

  let off = headerSize;
  for (const pkt of packets) { page.set(pkt, off); off += pkt.length; }

  // Compute & write CRC
  dv.setUint32(22, oggCrc(page), true);
  return page;
}

// ─── Opus header helpers ─────────────────────────────────────────────
function createOpusHead(channels: number, sampleRate: number, preSkip = 3840): Uint8Array {
  const h = new Uint8Array(19);
  const v = new DataView(h.buffer);
  h.set([0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]); // "OpusHead"
  h[8] = 1;                     // version
  h[9] = channels;
  v.setUint16(10, preSkip, true);
  v.setUint32(12, sampleRate, true);
  v.setInt16(16, 0, true);       // output gain
  h[18] = 0;                    // channel mapping family
  return h;
}

function createOpusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("Lovable");
  const t = new Uint8Array(8 + 4 + vendor.length + 4);
  const v = new DataView(t.buffer);
  t.set([0x4F, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]); // "OpusTags"
  v.setUint32(8, vendor.length, true);
  t.set(vendor, 12);
  v.setUint32(12 + vendor.length, 0, true); // 0 user comments
  return t;
}

// ─── Minimal WebM / EBML parser ──────────────────────────────────────
function readVint(buf: Uint8Array, off: number): { value: number; len: number } {
  if (off >= buf.length) return { value: 0, len: 0 };
  const b0 = buf[off];
  if (b0 === 0) return { value: 0, len: 1 };
  let w = 1, m = 0x80;
  while (!(b0 & m) && w < 8) { w++; m >>= 1; }
  let val = b0 & (m - 1);
  for (let i = 1; i < w && off + i < buf.length; i++) val = val * 256 + buf[off + i];
  return { value: val, len: w };
}

function readId(buf: Uint8Array, off: number): { id: number; len: number } {
  if (off >= buf.length) return { id: 0, len: 0 };
  const b0 = buf[off];
  let w = 1, m = 0x80;
  while (!(b0 & m) && w < 4) { w++; m >>= 1; }
  let id = b0;
  for (let i = 1; i < w && off + i < buf.length; i++) id = id * 256 + buf[off + i];
  return { id, len: w };
}

const UNKNOWN_SIZE = new Set([0x7F, 0x3FFF, 0x1FFFFF, 0x0FFFFFFF]);

const MASTERS = new Set([
  0x1A45DFA3, // EBML
  0x18538067, // Segment
  0x1654AE6B, // Tracks
  0xAE,       // TrackEntry
  0xE1,       // Audio
  0x1F43B675, // Cluster
]);

interface ParseResult { frames: Uint8Array[]; sampleRate: number; channels: number }

function parseWebm(data: Uint8Array): ParseResult {
  const frames: Uint8Array[] = [];
  let sampleRate = 48000;
  let channels = 1;
  let pos = 0;

  function walk(end: number) {
    while (pos + 2 < end && pos + 2 < data.length) {
      const { id, len: idLen } = readId(data, pos);
      if (idLen === 0) break;
      pos += idLen;
      const { value: size, len: sLen } = readVint(data, pos);
      if (sLen === 0) break;
      pos += sLen;

      const unknown = UNKNOWN_SIZE.has(size);
      const elEnd = unknown ? end : Math.min(pos + size, end);

      if (MASTERS.has(id)) { walk(elEnd); if (!unknown) pos = elEnd; continue; }

      // Audio channels
      if (id === 0x9F && size <= 4) {
        let ch = 0;
        for (let i = 0; i < size; i++) ch = ch * 256 + data[pos + i];
        channels = ch || 1;
      }

      // Sampling frequency (float)
      if (id === 0xB5) {
        const dv = new DataView(data.buffer, data.byteOffset + pos, size);
        sampleRate = Math.round(size === 8 ? dv.getFloat64(0) : dv.getFloat32(0));
      }

      // SimpleBlock
      if (id === 0xA3 && size > 4) {
        const { len: tvLen } = readVint(data, pos);
        const hdr = tvLen + 3; // track vint + 2B timestamp + 1B flags
        if (size > hdr) {
          const flags = data[pos + tvLen + 2];
          const lacing = (flags >> 1) & 0x03;
          if (lacing === 0) {
            frames.push(data.slice(pos + hdr, elEnd));
          } else if (lacing === 2) {
            // Fixed-size lacing
            const numFrames = data[pos + hdr] + 1;
            const lacingHdr = hdr + 1;
            const totalData = size - lacingHdr;
            const frameSize = Math.floor(totalData / numFrames);
            for (let f = 0; f < numFrames; f++) {
              const start = pos + lacingHdr + f * frameSize;
              frames.push(data.slice(start, start + frameSize));
            }
          } else if (lacing === 1) {
            // Xiph lacing
            const numFrames = data[pos + hdr] + 1;
            let lacingPos = pos + hdr + 1;
            const frameSizes: number[] = [];
            let totalLacedSize = 0;
            for (let f = 0; f < numFrames - 1; f++) {
              let fSize = 0;
              while (lacingPos < elEnd && data[lacingPos] === 255) {
                fSize += 255;
                lacingPos++;
              }
              if (lacingPos < elEnd) { fSize += data[lacingPos]; lacingPos++; }
              frameSizes.push(fSize);
              totalLacedSize += fSize;
            }
            // Last frame gets the rest
            const remaining = elEnd - lacingPos - totalLacedSize;
            frameSizes.push(remaining > 0 ? remaining : 0);
            let dataPos = lacingPos;
            for (const fSize of frameSizes) {
              if (fSize > 0 && dataPos + fSize <= elEnd) {
                frames.push(data.slice(dataPos, dataPos + fSize));
              }
              dataPos += fSize;
            }
          } else {
            // EBML lacing — rare for Opus, treat as single for safety
            frames.push(data.slice(pos + hdr, elEnd));
          }
        }
      }

      pos = elEnd;
    }
  }

  try { walk(data.length); } catch (e) { console.warn("[WebM parse]", e); }
  return { frames, sampleRate, channels };
}

// ─── Public API ──────────────────────────────────────────────────────
export function convertWebmToOgg(webmBytes: Uint8Array): Uint8Array {
  const { frames, sampleRate, channels } = parseWebm(webmBytes);

  if (frames.length === 0) {
    throw new Error("No Opus frames found in WebM container");
  }

  console.log(`[WebM→OGG] ${frames.length} frames, sr=${sampleRate}, ch=${channels}`);

  const serial = (Math.random() * 0xFFFFFFFF) >>> 0;
  const pages: Uint8Array[] = [];
  let seq = 0;

  // BOS page — OpusHead
  pages.push(buildOggPage(0x02, 0n, serial, seq++, [createOpusHead(channels, sampleRate)]));
  // Comment page — OpusTags
  pages.push(buildOggPage(0x00, 0n, serial, seq++, [createOpusTags()]));

  // Audio pages — max 200 frames or 48 KB per page
  const SAMPLES_PER_FRAME = 960; // 20 ms @ 48 kHz
  let granule = BigInt(0);
  let pagePkts: Uint8Array[] = [];
  let pageBytes = 0;

  for (let i = 0; i < frames.length; i++) {
    pagePkts.push(frames[i]);
    pageBytes += frames[i].length;
    granule += BigInt(SAMPLES_PER_FRAME);

    const last = i === frames.length - 1;
    if (pagePkts.length >= 200 || pageBytes >= 48000 || last) {
      pages.push(buildOggPage(last ? 0x04 : 0x00, granule, serial, seq++, pagePkts));
      pagePkts = [];
      pageBytes = 0;
    }
  }

  const total = pages.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of pages) { out.set(p, off); off += p.length; }

  console.log(`[WebM→OGG] Output: ${out.length} bytes, ${pages.length} pages`);
  return out;
}
