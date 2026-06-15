# JWT API (FastAPI)

Minimal FastAPI sample for APIScope testing: FastAPI route scanning, JWT bearer authentication, public vs protected endpoints, and token expiration.

**Not for production use.**

## Requirements

- Python 3.11+

## Installation

```bash
cd sample-projects/jwt-api-fastapi
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Server: [http://localhost:8000](http://localhost:8000)

Startup log:

```text
JWT API started on port 8000
```

OpenAPI:

- [http://localhost:8000/docs](http://localhost:8000/docs)
- [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

## Demo user

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `admin` |

JWT: HS256, secret `apiscope-secret-key`, access token expires in 1 hour.

## Endpoints

| Method | Path          | Auth     | Description              |
|--------|---------------|----------|--------------------------|
| GET    | `/health`     | None     | Health check             |
| GET    | `/public`     | None     | Public endpoint          |
| POST   | `/auth/login` | None     | Issue JWT access token   |
| GET    | `/auth/me`    | Bearer   | Current user             |
| GET    | `/private`    | Bearer   | Protected endpoint       |

## Examples

Public:

```bash
curl http://localhost:8000/public
```

Login:

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

Protected (replace `<token>` with `access_token` from login):

```bash
curl http://localhost:8000/private \
  -H "Authorization: Bearer <token>"
```

Current user:

```bash
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer <token>"
```

Health:

```bash
curl http://localhost:8000/health
```

## APIScope testing

Use this project to validate:

- FastAPI scanner route discovery (`@app.get`, `@app.post`)
- Bearer token authentication in APIScope
- Public vs protected request execution
- JWT expiration (wait 1 hour or use an expired token)
