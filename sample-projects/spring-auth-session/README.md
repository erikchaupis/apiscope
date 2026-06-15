# spring-auth-session

Educational Spring Boot sample demonstrating **session-based authentication** with Spring Security form login and server-side sessions (`JSESSIONID`).

## Stack

- Java 21
- Spring Boot 3.5
- Spring Web, Spring Security, Thymeleaf
- Maven

## Run

```bash
cd sample-projects/spring-auth-session
mvn spring-boot:run
```

Server starts on **http://localhost:8086**.

## Login

| Field    | Value     |
|----------|-----------|
| Username | `admin`   |
| Password | `admin123`|

After login you are redirected to `/tickets`.

## UI Endpoints

| Endpoint              | Auth     | Description              |
|-----------------------|----------|--------------------------|
| `GET /health`         | Public   | Returns `OK`             |
| `GET /login`          | Public   | Login page               |
| `GET /tickets`        | Required | List tickets             |
| `GET /tickets/new`    | Required | Create form              |
| `POST /tickets`       | Required | Create ticket            |
| `GET /tickets/{id}/edit` | Required | Edit form             |
| `POST /tickets/{id}`  | Required | Update ticket            |
| `POST /tickets/{id}/delete` | Required | Delete ticket      |

## REST API Endpoints

All API endpoints require the same session cookie (`JSESSIONID`) set after form login.

| Method   | Endpoint            | Auth     | Response                    |
|----------|---------------------|----------|-----------------------------|
| `GET`    | `/api/tickets`      | Required | `200` + JSON array          |
| `GET`    | `/api/tickets/{id}` | Required | `200` or `404`              |
| `POST`   | `/api/tickets`      | Required | `201` + created ticket      |
| `PUT`    | `/api/tickets/{id}` | Required | `200` or `404`              |
| `DELETE` | `/api/tickets/{id}` | Required | `204` or `404`              |

Request body for create/update:

```json
{
  "name": "My ticket",
  "description": "Details here"
}
```

Tickets are stored in an in-memory `ConcurrentHashMap` inside `TicketService` — shared by both the UI and API controllers.

## Try it (browser)

1. `curl http://localhost:8086/health` → `OK` (no login)
2. Open `http://localhost:8086/tickets` → redirected to login
3. Sign in as `admin` / `admin123`
4. Create, edit, and delete tickets in the browser

## Try it (API with curl)

Fetch the login page to start a session and read the CSRF token from the HTML form:

```bash
curl -c cookies.txt -b cookies.txt http://localhost:8086/login -o login.html
CSRF=$(grep -o 'name="_csrf" value="[^"]*"' login.html | head -1 | sed 's/.*value="//;s/"//')
```

Log in with the session cookie and CSRF token:

```bash
curl -c cookies.txt -b cookies.txt \
  -d "username=admin&password=admin123&_csrf=$CSRF" \
  -X POST http://localhost:8086/login
```

List tickets as JSON:

```bash
curl -b cookies.txt http://localhost:8086/api/tickets
```

Mutating requests (`POST`, `PUT`, `DELETE`) require a fresh CSRF token from an authenticated page:

```bash
curl -b cookies.txt http://localhost:8086/tickets -o tickets.html
CSRF=$(grep -o 'name="_csrf" value="[^"]*"' tickets.html | head -1 | sed 's/.*value="//;s/"//')

curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"name":"API ticket","description":"Created via REST"}' \
  -X POST http://localhost:8086/api/tickets
```

Update a ticket:

```bash
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-TOKEN: $CSRF" \
  -d '{"name":"Updated name","description":"Updated description"}' \
  -X PUT http://localhost:8086/api/tickets/1
```

Delete a ticket:

```bash
curl -b cookies.txt \
  -H "X-CSRF-TOKEN: $CSRF" \
  -X DELETE http://localhost:8086/api/tickets/1
```

Tickets created via the API appear in the browser UI and vice versa.
