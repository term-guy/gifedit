# template_vue_go

This template pairs a Vue 3 frontend with a Go + Fiber backend that is structured for growth instead of only demo use.

## Backend

The backend keeps Fiber, but adds the pieces that make a template reusable:

- Typed config loading from `.env`
- Dependency-injected handlers, services, and repositories
- SQLite storage with GORM
- Versioned schema migrations with `goose`
- Optional seed command instead of implicit boot-time seeding
- API versioning under `/api/v1`
- Health endpoints at `/healthz` and `/readyz`
- Recover, request ID, CORS, structured logging, and graceful shutdown
- Basic HTTP test coverage

### Backend setup

1. Install Go `1.25+`
2. Install Air for hot reload:

```sh
go install github.com/air-verse/air@latest
```

3. Copy the backend environment file:

```sh
cd backend
cp .env.example .env
```

4. Run migrations and seed demo data:

```sh
make migrate-up
make seed
```

5. Start the API:

```sh
make run
```

### Backend commands

```sh
make dev
make run
make migrate-up
make migrate-down
make migrate-status
make seed
make test
make fmt
```

### Backend layout

- `server.go`: CLI entrypoint for `serve`, `migrate`, and `seed`
- `internal/config`: validated app configuration
- `internal/app`: app container and dependency wiring
- `internal/database`: SQLite connection, migrations, and seed logic
- `internal/repository`: persistence models and data access
- `internal/service`: business logic
- `internal/http`: handlers, DTOs, router, and API error/response helpers
- `migrations`: versioned `goose` SQL migrations

## Frontend

The frontend is a Vue 3 + Vite app with Pinia and Vue Router. It now targets the backend at `VITE_API_URL` and calls `/api/v1/...` under that base URL.

### Frontend setup

```sh
cd frontend
npm install
npm run dev
```
