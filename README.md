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

```bash
cp .env.example .env
```

- Install [Docker](https://docs.docker.com/get-docker/) (with Compose). It is
  not required to run the API itself, but is used to provision a disposable
  [PostgreSQL](https://postgresql.org) test database for the end-to-end tests
  (`yarn test:e2e`) and for generating database types (`yarn codegen`).

- If you want to use the test database in development, set `DATABASE_URL` to the value of `TEST_DATABASE_URL` in `.env` and run `yarn testdb:up`.

- You can also use your own database.
  Install [PostgreSQL](https://postgresql.org), set `DATABASE_URL`, and use [dbmate](https://github.com/amacneil/dbmate):

```bash
# Create and migrate the database
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

- `yarn test`: run everything (unit and e2e).
- `yarn test:unit`: run unit tests only (`test/**/*.test.ts`).
- `yarn test:e2e`: run e2e tests only (`test/**/*.e2e.ts`).

The e2e tests require a database. `yarn test:e2e` starts and migrates the dockerized test
database (`yarn testdb:up`) and runs the tests. Tear it down afterwards with `yarn testdb:down`.

## Database migrations

Migrations are managed with [`dbmate`](https://github.com/amacneil/dbmate) and located in [`./db/migrations`](./db/migrations).
Create a new migration with:

```sh
yarn dbmate new <migration_name>
```

Add SQL statements in the `-- migrate:up` and (optional) `-- migrate:down` sections, then run `yarn codegen`. 

## Database types

Row types in `src/db/generated/` are derived from the live Postgres schema by
[`kanel`](https://github.com/kristiandupont/kanel) (configured in
`.kanelrc.cjs`). Regenerate after any schema change (migration):

```sh
yarn codegen
```

## Documentation

The OpenAPI spec is generated from Zod schemas, which are the single source of
truth for both runtime validation and the documentation:

- `src/schemas/`: Zod component schemas, parameters, and security schemes,
  registered with [`@asteasolutions/zod-to-openapi`](https://github.com/asteasolutions/zod-to-openapi).
- `src/routes/*.ts`: Each route declares its OpenAPI operation inline via a
  compact spec alongside its handler. The same schemas drive runtime request
  validation and compile-time response typing: a handler's return type is bound
  to its documented 2xx response schema.
- `docs/base.yml`: Static metadata (`info`, `tags`, `servers`).

`scripts/build-openapi.ts` registers every schema and route operation, merges
`base.yml`, and writes the bundled `docs/openapi.yml`.

Build and validate the spec:

```sh
yarn docs
```

Type-check the TypeScript sources:

```sh
yarn typecheck
```
