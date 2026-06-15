# Files API (Node.js)

Minimal Express API for testing APIScope file upload and download capabilities.

This project is for local testing only. No authentication, database, or frontend.

## Requirements

- Node.js 18+

## Installation

```bash
cd sample-projects/files-api-nodejs
npm install
```

## Start

```bash
npm start
```

Server URL: `http://localhost:3001`

Startup log:

```text
Files API started on port 3001
```

The server creates `uploads/` and generates sample files in `sample-files/` automatically when missing.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/upload/single` | Upload one file (`file` field) |
| POST | `/upload/multiple` | Upload multiple files (`files` field) |
| GET | `/download/text` | Plain text download |
| GET | `/download/json` | JSON download |
| GET | `/download/pdf` | PDF attachment download |
| GET | `/download/image` | PNG image download |
| GET | `/download/zip` | ZIP attachment download |
| GET | `/download/blob?size=1mb` | Large generated binary (also `10mb`, `50mb`) |
| GET | `/download/slow` | Slow streamed binary download |

## Example curl commands

Health check:

```bash
curl http://localhost:3001/health
```

Upload a single file:

```bash
curl -X POST http://localhost:3001/upload/single \
  -F "file=@./sample-files/sample.pdf"
```

Upload multiple files:

```bash
curl -X POST http://localhost:3001/upload/multiple \
  -F "files=@./sample-files/sample.txt" \
  -F "files=@./sample-files/sample.json"
```

Download text:

```bash
curl http://localhost:3001/download/text
```

Download JSON:

```bash
curl http://localhost:3001/download/json
```

Download PDF:

```bash
curl -OJ http://localhost:3001/download/pdf
```

Download image:

```bash
curl -O http://localhost:3001/download/image
```

Download ZIP:

```bash
curl -OJ http://localhost:3001/download/zip
```

Large binary download (1 MB):

```bash
curl -OJ "http://localhost:3001/download/blob?size=1mb"
```

Large binary download (10 MB):

```bash
curl -OJ "http://localhost:3001/download/blob?size=10mb"
```

Slow download:

```bash
curl -OJ http://localhost:3001/download/slow
```

## Project layout

```text
files-api-nodejs/
├── package.json
├── server.js
├── uploads/          # created at runtime
└── sample-files/     # generated at startup if missing
    ├── sample.txt
    ├── sample.json
    ├── sample.pdf
    ├── sample.png
    └── sample.zip
```

## APIScope testing ideas

- Multipart single and multiple uploads
- Binary, image, PDF, and ZIP downloads
- Content-Type and Content-Disposition handling
- Large response bodies via `/download/blob`
- Streaming and slow transfers via `/download/slow`
- History storage for file-related requests
