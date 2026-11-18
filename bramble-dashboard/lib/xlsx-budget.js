import { inflateRawSync } from "node:zlib";
import { MAX_UPLOAD_ROWS, MAX_XLSX_ENTRIES, MAX_XLSX_UNCOMPRESSED_BYTES } from "./config.js";

const TOO_LARGE = "That spreadsheet expands too far to import. Save it as a .csv, or upload one month at a time.";
const TOO_MANY_ROWS = `That sheet has more than ${MAX_UPLOAD_ROWS.toLocaleString()} rows. Try uploading one month at a time.`;
const UNREADABLE = "That spreadsheet could not be read. Save it as a .csv and try again.";

export class SpreadsheetTooLargeError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpreadsheetTooLargeError";
  }
}

function fail(message) {
  throw new Error(message);
}

function range(buffer, offset, length) {
  if (offset < 0 || length < 0 || offset + length > buffer.length) fail(UNREADABLE);
  return buffer.subarray(offset, offset + length);
}

function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) !== 0x06054b50) continue;
    const commentLength = buffer.readUInt16LE(i + 20);
    if (i + 22 + commentLength === buffer.length) return i;
  }
  fail(UNREADABLE);
}

function isWorksheet(name) {
  return name.startsWith("xl/worksheets/") && name.endsWith(".xml");
}

function countRows(bytes) {
  const text = Buffer.from(bytes).toString("latin1");
  let count = 0;
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf("<row", from);
    if (index === -1) break;
    const next = text[index + 4];
    if (next === ">" || next === " " || next === "/") count += 1;
    from = index + 4;
  }
  return count;
}

function readEntries(buffer) {
  const eocd = findEocd(buffer);
  if (buffer.readUInt16LE(eocd + 4) !== 0 || buffer.readUInt16LE(eocd + 6) !== 0) fail(UNREADABLE);
  const count = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (count > MAX_XLSX_ENTRIES) throw new SpreadsheetTooLargeError(TOO_LARGE);
  const directory = range(buffer, directoryOffset, directorySize);
  const entries = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) fail(UNREADABLE);
    const flags = directory.readUInt16LE(cursor + 8);
    const method = directory.readUInt16LE(cursor + 10);
    const compressedSize = directory.readUInt32LE(cursor + 20);
    const uncompressedSize = directory.readUInt32LE(cursor + 24);
    const nameLength = directory.readUInt16LE(cursor + 28);
    const extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    const localOffset = directory.readUInt32LE(cursor + 42);
    if (flags & 1) fail(UNREADABLE);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) throw new SpreadsheetTooLargeError(TOO_LARGE);
    const name = range(directory, cursor + 46, nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) fail(UNREADABLE);
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    entries.push({ name, method, compressedSize, uncompressedSize, dataStart });
  }
  return entries;
}

/**
 * Rejects an xlsx whose zip entries expand past a fixed budget, or whose sheets
 * already contain more than the row limit, before the workbook parser runs.
 */
export function assertXlsxWithinBudget(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) fail(UNREADABLE);
  const entries = readEntries(buffer);
  let uncompressed = 0;
  let rows = 0;
  for (const entry of entries) {
    const room = MAX_XLSX_UNCOMPRESSED_BYTES - uncompressed;
    if (entry.uncompressedSize > room) throw new SpreadsheetTooLargeError(TOO_LARGE);
    const compressed = range(buffer, entry.dataStart, entry.compressedSize);
    let inflated = compressed;
    if (entry.method === 8) {
      try {
        inflated = inflateRawSync(compressed, { maxOutputLength: entry.uncompressedSize });
      } catch (error) {
        if (error?.code === "ERR_BUFFER_TOO_LARGE") throw new SpreadsheetTooLargeError(TOO_LARGE);
        fail(UNREADABLE);
      }
    } else if (entry.method !== 0) {
      fail(UNREADABLE);
    }
    if (inflated.length !== entry.uncompressedSize) fail(UNREADABLE);
    uncompressed += inflated.length;
    if (uncompressed > MAX_XLSX_UNCOMPRESSED_BYTES) throw new SpreadsheetTooLargeError(TOO_LARGE);
    if (isWorksheet(entry.name)) rows += countRows(inflated);
    if (rows > MAX_UPLOAD_ROWS + 1) throw new SpreadsheetTooLargeError(TOO_MANY_ROWS);
  }
}
