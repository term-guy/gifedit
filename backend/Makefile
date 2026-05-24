APP_ENV_FILE ?= .env

.PHONY: dev run migrate-up migrate-down migrate-status seed test lint fmt

dev:
	air

run:
	go run . serve

migrate-up:
	go run . migrate up

migrate-down:
	go run . migrate down

migrate-status:
	go run . migrate status

seed:
	go run . seed

test:
	go test ./...

lint:
	golangci-lint run

fmt:
	gofmt -w .
