# spring-demo

Minimal Spring Boot API sample for APIScope.

## Run

```bash
mvn spring-boot:run
```

Server starts on **http://localhost:8085** (`server.port` in `application.properties`).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users |
| GET | `/users/{id}` | Get user by id |
| POST | `/users` | Create user (JSON body: `name`, `lastname`) |
| PUT | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |
| GET | `/users/search?name=Ada` | Search by name |

Seed data: `{ "id": 1, "name": "Ada", "lastname": "Lovelace" }`.
