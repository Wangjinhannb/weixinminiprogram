function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function utf8Bytes(str) {
  str = String(str == null ? '' : str);
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      var next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code <= 0x7ff) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

var crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(bytes) {
  var table = getCrcTable();
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pushU16(out, value) {
  value = value >>> 0;
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushU32(out, value) {
  value = value >>> 0;
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatUint8(parts, totalLength) {
  var out = new Uint8Array(totalLength);
  var offset = 0;
  for (var i = 0; i < parts.length; i++) {
    out.set(parts[i], offset);
    offset += parts[i].length;
  }
  return out;
}

function makeZip(files) {
  var localParts = [];
  var centralParts = [];
  var records = [];
  var offset = 0;
  var i;
  for (i = 0; i < files.length; i++) {
    var nameBytes = utf8Bytes(files[i].name);
    var dataBytes = files[i].data instanceof Uint8Array ? files[i].data : utf8Bytes(files[i].data);
    var crc = crc32(dataBytes);
    var local = [];
    pushU32(local, 0x04034b50);
    pushU16(local, 20);
    pushU16(local, 0);
    pushU16(local, 0);
    pushU16(local, 0);
    pushU16(local, 0);
    pushU32(local, crc);
    pushU32(local, dataBytes.length);
    pushU32(local, dataBytes.length);
    pushU16(local, nameBytes.length);
    pushU16(local, 0);
    var localHeader = new Uint8Array(local);
    var localRecord = concatUint8([localHeader, nameBytes, dataBytes], localHeader.length + nameBytes.length + dataBytes.length);
    localParts.push(localRecord);
    records.push({ nameBytes: nameBytes, crc: crc, size: dataBytes.length, offset: offset });
    offset += localRecord.length;
  }
  var centralOffset = offset;
  var centralSize = 0;
  for (i = 0; i < records.length; i++) {
    var r = records[i];
    var central = [];
    pushU32(central, 0x02014b50);
    pushU16(central, 20);
    pushU16(central, 20);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU32(central, r.crc);
    pushU32(central, r.size);
    pushU32(central, r.size);
    pushU16(central, r.nameBytes.length);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU32(central, 0);
    pushU32(central, r.offset);
    var centralHeader = new Uint8Array(central);
    var centralRecord = concatUint8([centralHeader, r.nameBytes], centralHeader.length + r.nameBytes.length);
    centralParts.push(centralRecord);
    centralSize += centralRecord.length;
  }
  var eocd = [];
  pushU32(eocd, 0x06054b50);
  pushU16(eocd, 0);
  pushU16(eocd, 0);
  pushU16(eocd, records.length);
  pushU16(eocd, records.length);
  pushU32(eocd, centralSize);
  pushU32(eocd, centralOffset);
  pushU16(eocd, 0);
  var end = new Uint8Array(eocd);
  return concatUint8(localParts.concat(centralParts).concat([end]), centralOffset + centralSize + end.length);
}

function columnName(num) {
  var name = '';
  while (num > 0) {
    var m = (num - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    num = Math.floor((num - 1) / 26);
  }
  return name;
}

function cellRef(row, col) {
  return columnName(col) + row;
}

function safeSheetName(name) {
  name = String(name || 'Sheet1').replace(/[\\\/\?\*\[\]:]/g, '').trim() || 'Sheet1';
  return name.slice(0, 31);
}

function safeFileName(name) {
  name = String(name || '预约导出').replace(/[\\\/\?\*\[\]:"<>|]/g, '_').replace(/\s+/g, '_').trim();
  return name || '预约导出';
}

function buildSheetXml(rows) {
  rows = rows || [];
  var maxCols = 0;
  for (var i = 0; i < rows.length; i++) if ((rows[i] || []).length > maxCols) maxCols = rows[i].length;
  var widths = [8, 18, 12, 14, 12, 12, 18, 16, 16, 8, 22, 28, 16, 28, 28];
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
  xml += '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
  if (maxCols > 0) {
    xml += '<cols>';
    for (var c = 1; c <= maxCols; c++) {
      var w = widths[c - 1] || 16;
      xml += '<col min="' + c + '" max="' + c + '" width="' + w + '" customWidth="1"/>';
    }
    xml += '</cols>';
  }
  xml += '<sheetData>';
  for (var r = 0; r < rows.length; r++) {
    var rowNo = r + 1;
    xml += '<row r="' + rowNo + '">';
    var row = rows[r] || [];
    for (c = 0; c < maxCols; c++) {
      var value = row[c] == null ? '' : String(row[c]);
      var style = r === 0 ? ' s="1"' : '';
      xml += '<c r="' + cellRef(rowNo, c + 1) + '" t="inlineStr"' + style + '><is><t>' + xmlEscape(value) + '</t></is></c>';
    }
    xml += '</row>';
  }
  xml += '</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>';
  return xml;
}

function buildXlsxBuffer(rows, options) {
  options = options || {};
  var sheetName = safeSheetName(options.sheetName || '已预约');
  var created = new Date().toISOString();
  var files = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' },
    { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>场地预约</dc:creator><cp:lastModifiedBy>场地预约</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' + created + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + created + '</dcterms:modified></cp:coreProperties>' },
    { name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>场地预约</Application></Properties>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xmlEscape(sheetName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    { name: 'xl/worksheets/sheet1.xml', data: buildSheetXml(rows) }
  ];
  var zip = makeZip(files);
  if (zip.buffer.slice) return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
  return zip.buffer;
}

function writeXlsxFile(options) {
  options = options || {};
  var rows = options.rows || [];
  if (!rows.length) throw new Error('没有可导出的数据');
  if (typeof wx === 'undefined' || !wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) throw new Error('当前环境不支持导出文件');
  var fileName = safeFileName(options.fileName || '预约导出') + '.xlsx';
  var filePath = wx.env.USER_DATA_PATH + '/' + fileName;
  var buffer = buildXlsxBuffer(rows, { sheetName: options.sheetName || '已预约' });
  wx.getFileSystemManager().writeFileSync(filePath, buffer);
  return filePath;
}

module.exports = {
  writeXlsxFile: writeXlsxFile,
  buildXlsxBuffer: buildXlsxBuffer
};
