const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const PORT = 3002;
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const SAMPLE_FILES_DIR = path.join(ROOT, 'sample-files');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function requestLogger(req, _res, next) {
  console.log(`[${req.method}] ${req.path}`);
  next();
}

function parseSizeParam(rawSize) {
  if (!rawSize || typeof rawSize !== 'string') {
    return null;
  }

  const match = rawSize.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = match[2] || 'b';

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const multipliers = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const bytes = Math.floor(amount * multipliers[unit]);
  const maxBytes = 100 * 1024 * 1024;
  return Math.min(bytes, maxBytes);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipBuffer(fileName, fileContent) {
  const nameBuffer = Buffer.from(fileName, 'utf8');
  const contentBuffer = Buffer.isBuffer(fileContent)
    ? fileContent
    : Buffer.from(String(fileContent), 'utf8');
  const crc = crc32(contentBuffer);
  const localHeader = Buffer.alloc(30 + nameBuffer.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(contentBuffer.length, 18);
  localHeader.writeUInt32LE(contentBuffer.length, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuffer.copy(localHeader, 30);

  const centralHeader = Buffer.alloc(46 + nameBuffer.length);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(contentBuffer.length, 20);
  centralHeader.writeUInt32LE(contentBuffer.length, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);
  nameBuffer.copy(centralHeader, 46);

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(1, 8);
  endRecord.writeUInt16LE(1, 10);
  endRecord.writeUInt32LE(centralHeader.length, 12);
  endRecord.writeUInt32LE(localHeader.length + contentBuffer.length, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([localHeader, contentBuffer, centralHeader, endRecord]);
}

function createMinimalPdf() {
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj',
      '4 0 obj << /Length 44 >> stream',
      'BT /F1 24 Tf 72 72 Td (APIScope sample PDF) Tj ET',
      'endstream endobj',
      'xref',
      '0 5',
      '0000000000 65535 f ',
      '0000000010 00000 n ',
      '0000000060 00000 n ',
      '0000000114 00000 n ',
      '0000000214 00000 n ',
      'trailer << /Size 5 /Root 1 0 R >>',
      'startxref',
      '320',
      '%%EOF',
    ].join('\n'),
    'utf8'
  );
}

function createMinimalPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XVe0AAAAASUVORK5CYII=',
    'base64'
  );
}

function writeIfMissing(filePath, content) {
  if (!fs.existsSync(filePath)) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    fs.writeFileSync(filePath, buffer);
  }
}

function ensureSampleFiles() {
  ensureDir(SAMPLE_FILES_DIR);

  writeIfMissing(
    path.join(SAMPLE_FILES_DIR, 'sample.txt'),
    'APIScope files API sample text file.\nUse this endpoint to test plain text downloads.\n'
  );

  writeIfMissing(
    path.join(SAMPLE_FILES_DIR, 'sample.json'),
    JSON.stringify(
      {
        message: 'APIScope files API sample JSON',
        version: 1,
        features: ['upload', 'download', 'streaming'],
      },
      null,
      2
    ) + '\n'
  );

  writeIfMissing(path.join(SAMPLE_FILES_DIR, 'sample.pdf'), createMinimalPdf());
  writeIfMissing(path.join(SAMPLE_FILES_DIR, 'sample.png'), createMinimalPng());
  writeIfMissing(
    path.join(SAMPLE_FILES_DIR, 'sample.zip'),
    createZipBuffer('readme.txt', 'APIScope sample zip archive.\n')
  );
}

function sendSampleFile(res, fileName, options) {
  const filePath = path.join(SAMPLE_FILES_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Sample file missing: ${fileName}` });
    return;
  }

  if (options.contentType) {
    res.setHeader('Content-Type', options.contentType);
  }
  if (options.disposition) {
    res.setHeader('Content-Disposition', options.disposition);
  }

  res.sendFile(filePath);
}

ensureDir(UPLOADS_DIR);
ensureSampleFiles();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = path.basename(file.originalname).replace(/[^\w.\-()+ ]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const uploadSingle = multer({ storage }).single('file');
const uploadMultiple = multer({ storage }).array('files', 20);

const app = express();
app.use(express.json());
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'UP' });
});

app.post('/upload/single', (req, res) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'Expected multipart field "file"' });
      return;
    }

    res.json({
      success: true,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
    });
  });
});

app.post('/upload/multiple', (req, res) => {
  uploadMultiple(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, error: err.message });
      return;
    }

    if (!req.files || req.files.length === 0) {
      res.status(400).json({ success: false, error: 'Expected multipart field "files"' });
      return;
    }

    res.json({
      success: true,
      count: req.files.length,
      files: req.files.map((file) => ({
        name: file.originalname,
        size: file.size,
      })),
    });
  });
});

app.get('/download/text', (_req, res) => {
  sendSampleFile(res, 'sample.txt', { contentType: 'text/plain' });
});

app.get('/download/json', (_req, res) => {
  sendSampleFile(res, 'sample.json', { contentType: 'application/json' });
});

app.get('/download/pdf', (_req, res) => {
  sendSampleFile(res, 'sample.pdf', {
    contentType: 'application/pdf',
    disposition: 'attachment; filename="sample.pdf"',
  });
});

app.get('/download/image', (_req, res) => {
  sendSampleFile(res, 'sample.png', { contentType: 'image/png' });
});

app.get('/download/zip', (_req, res) => {
  sendSampleFile(res, 'sample.zip', {
    contentType: 'application/zip',
    disposition: 'attachment; filename="sample.zip"',
  });
});

app.get('/download/blob', (req, res) => {
  const size = parseSizeParam(req.query.size);
  if (size === null) {
    res.status(400).json({
      error: 'Invalid or missing size query parameter. Examples: 1mb, 10mb, 50mb',
    });
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="blob-${size}.bin"`);
  res.setHeader('Content-Length', String(size));

  const chunkSize = 64 * 1024;
  let sent = 0;

  function writeChunk() {
    while (sent < size) {
      const remaining = size - sent;
      const currentChunkSize = Math.min(chunkSize, remaining);
      const chunk = Buffer.alloc(currentChunkSize, sent % 256);
      sent += currentChunkSize;

      const canContinue = res.write(chunk);
      if (!canContinue) {
        res.once('drain', writeChunk);
        return;
      }
    }
    res.end();
  }

  writeChunk();
});

app.get('/download/slow', (_req, res) => {
  const totalBytes = 256 * 1024;
  const chunkSize = 8 * 1024;
  const delayMs = 250;

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="slow-download.bin"');
  res.setHeader('Content-Length', String(totalBytes));

  let sent = 0;

  function sendNextChunk() {
    if (sent >= totalBytes) {
      res.end();
      return;
    }

    const remaining = totalBytes - sent;
    const currentChunkSize = Math.min(chunkSize, remaining);
    const chunk = Buffer.alloc(currentChunkSize, (sent / chunkSize) % 256);
    sent += currentChunkSize;
    res.write(chunk);
    setTimeout(sendNextChunk, delayMs);
  }

  sendNextChunk();
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Files API started on port ${PORT}`);
});
