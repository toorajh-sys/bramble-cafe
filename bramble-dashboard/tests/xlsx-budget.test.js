import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import { readSheet } from "read-excel-file/node";
import { MAX_UPLOAD_ROWS, MAX_XLSX_UNCOMPRESSED_BYTES } from "../lib/config.js";
import { assertXlsxWithinBudget, SpreadsheetTooLargeError } from "../lib/xlsx-budget.js";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zipFiles(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const raw = Buffer.from(file.data);
    const method = file.method ?? 8;
    const compressed = method === 0 ? raw : deflateRawSync(raw);
    const declared = file.declaredUncompressed ?? raw.length;
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(name.length, 26);
    const localRecord = Buffer.concat([local, name, compressed]);
    locals.push(localRecord);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(declared, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, name]));
    offset += localRecord.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

function workbook() {
  return zipFiles([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Item</t></is></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>2026-11-02</t></is></c><c r="B2" t="inlineStr"><is><t>Latte</t></is></c></row>
  </sheetData>
</worksheet>`,
    },
  ]);
}

test("a normal workbook stays inside the budget and can be parsed", async () => {
  const file = workbook();
  assertXlsxWithinBudget(file);
  const rows = await readSheet(file);
  assert.equal(rows[0][0], "Date");
  assert.equal(rows[1][1], "Latte");
});

test("an xlsx that inflates past its declared size is refused before parsing", () => {
  const file = zipFiles([
    {
      name: "xl/worksheets/sheet1.xml",
      data: Buffer.alloc(200_000, 0x20),
      declaredUncompressed: 64,
    },
  ]);
  assert.throws(() => assertXlsxWithinBudget(file), SpreadsheetTooLargeError);
});

test("an xlsx that declares more than the uncompressed budget is refused", () => {
  const file = zipFiles([
    {
      name: "xl/worksheets/sheet1.xml",
      method: 0,
      data: Buffer.alloc(32),
      declaredUncompressed: MAX_XLSX_UNCOMPRESSED_BYTES + 1,
    },
  ]);
  assert.throws(() => assertXlsxWithinBudget(file), SpreadsheetTooLargeError);
});

test("a sheet with more than the row limit is refused before parsing", () => {
  const rows = Array.from({ length: MAX_UPLOAD_ROWS + 2 }, () => "<row></row>").join("");
  const file = zipFiles([
    {
      name: "xl/worksheets/sheet1.xml",
      method: 0,
      data: `<worksheet><sheetData>${rows}</sheetData></worksheet>`,
    },
  ]);
  assert.throws(() => assertXlsxWithinBudget(file), (error) => {
    assert.ok(error instanceof SpreadsheetTooLargeError);
    assert.match(error.message, /more than/);
    return true;
  });
});
