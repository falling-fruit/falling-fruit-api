![Status](https://img.shields.io/badge/Status-Actively%20developed-darkgreen.svg?style=flat-square)

Falling Fruit API
=================

NodeJS API using [express](https://github.com/expressjs/express) and [pg-promise](https://github.com/vitaly-t/pg-promise).

You can browse the OpenAPI definition for the main branch [here](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/falling-fruit/api/main/docs/openapi.yml), and for the live API [here](https://petstore.swagger.io/?url=https://fallingfruit.org/api/0.3/openapi.yml).

# Status

Live at https://fallingfruit.org/api/0.3 and powers https://fallingfruit.org ([falling-fruit-web](https://github.com/falling-fruit/falling-fruit-web)).


# Development

## Installation

- Clone the repo and change into the new directory.

  ```sh
  git clone https://github.com/falling-fruit/falling-fruit-api
  cd falling-fruit-api
  ```

- Install the [`node`](https://nodejs.org) version specified in the `.nvmrc` file. This is easiest using [`nvm`](https://github.com/nvm-sh/nvm#installing-and-updating).

  ```sh
  nvm install
  nvm use
  ```

- [`yarn`](https://classic.yarnpkg.com/en/docs/install) is already provided (see [`.yarn/releases`](.yarn/releases)). Use it to install dependencies.

  ```sh
  yarn
  ```

- Copy `.env.example` to `.env` and update the values as needed.

  ```sh
  cp .env.example .env
  ```

### Database management

The API requires a [PostgreSQL](https://postgresql.org) database for development and testing. Two options:

- Either install [PostgreSQL](https://postgresql.org/download/) directly and set `DATABASE_URL` and `TEST_DATABASE_URL` accordingly in `.env`,

- or install [Docker](https://docs.docker.com/get-docker/) and start the PostgreSQL container configured in [`docker-compose.yml`](docker-compose.yml) with:

  ```sh
  yarn docker:up
  ```

  The server is accessible at `postgres://fallingfruit:fallingfruit@localhost:5433`, which `DATABASE_URL` and `TEST_DATABASE_URL` point to by default.

Databases are managed with [`dbmate`](https://github.com/amacneil/dbmate). Use `yarn dbmate` for the development database (`DATABASE_URL`) and `yarn dbmate-test` for the short-lived test database (`TEST_DATABASE_URL`).

```bash
# Create (if needed) and migrate (if needed) the database
yarn dbmate up
# Drop the database
yarn dbmate drop
```

## Usage

```sh
yarn start
```

Visit http://localhost:3300.

## Testing

Tests use the built-in [`node --test`](https://nodejs.org/api/test.html) runner, split by file naming convention:

- `yarn test`: run everything in [`test/`](test/) (unit and e2e).
- `yarn test:unit`: run unit tests only (`test/**/*.test.ts`).
- `yarn test:e2e`: run e2e tests only (`test/**/*.e2e.ts`).

The e2e tests require a test database. `yarn test:e2e` prepares the test
database (`yarn dbmate-test up`) and runs the tests.

## Database migrations

Migrations are managed with [`dbmate`](https://github.com/amacneil/dbmate) and located in [`./db/migrations`](./db/migrations).
Create a new migration with:

```sh
yarn dbmate new <migration_name>
```

Add SQL statements in the `-- migrate:up` and `-- migrate:down` sections, then run `yarn codegen` (see below). If the migration is irreversible, write `select 1/0` below `-- migrate:down` so that rolling back will throw an error.

## Database types

Row types in [`src/db/generated/`](src/db/generated/) are derived from the database schema using
[`kanel`](https://github.com/kristiandupont/kanel) (configured in
[`.kanelrc.cjs`](.kanelrc.cjs)). Regenerate after any schema change (migration) with:

```sh
yarn codegen
```

## Documentation

The OpenAPI spec is generated from Zod schemas, which are the single source of
truth for both runtime validation and the documentation:

- [`src/schemas/`](src/schemas/): Zod component schemas, parameters, and security schemes,
  registered with [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).
- [`src/routes/*.ts`](src/routes/): Each route declares its OpenAPI operation inline via a
  compact spec alongside its handler. The same schemas drive runtime request
  validation and compile-time response typing: a handler's return type is bound
  to its documented 2xx response schema.
- [`docs/base.yml`](docs/base.yml): Static metadata (`info`, `tags`, `servers`).

[`scripts/build-openapi.ts`](scripts/build-openapi.ts) registers every schema and route operation, merges
[`docs/base.yml`](docs/base.yml), and writes the bundled [`docs/openapi.yml`](docs/openapi.yml).

Build and validate the spec:

```sh
yarn docs
```

Type-check the TypeScript sources:

```sh
yarn typecheck
```
