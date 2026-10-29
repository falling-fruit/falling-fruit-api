![Status](https://img.shields.io/badge/Status-Actively%20developed-darkgreen.svg?style=flat-square)

Falling Fruit API
=================

NodeJS API using [express](https://github.com/expressjs/express), [pg-promise](https://github.com/vitaly-t/pg-promise), and [bluebird](https://github.com/petkaantonov/bluebird). The code structure is inspired by this [pg-promise demo](https://github.com/vitaly-t/pg-promise-demo) and this more general [tutorial](http://mherman.org/blog/2016/03/13/designing-a-restful-api-with-node-and-postgres/#.WgOMrhNSyEI).

You can browse the OpenAPI definition for the main branch [here](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/falling-fruit/api/main/docs/openapi.yml), and for the live API [here](https://petstore.swagger.io/?url=https://fallingfruit.org/api/0.3/openapi.yml).

# Status

Live at https://fallingfruit.org/api/0.3 and powers https://fallingfruit.org ([falling-fruit-web](https://github.com/falling-fruit/falling-fruit-web)).

# Layout

- `src/index.ts`: Load configuration and start the server.
- `src/app.ts`: Assemble the Express app (middleware, routers).
- `src/dependencies.ts`: Wire up db, mailer, photos, middleware, and routes.
- `src/routes/`
  - `index.ts`: Compile all route factories.
  - `makeRouter.ts`: Router factory with per-route request validation.
  - `openapi.ts`: Compact route spec → OpenAPI operation + validation config.
  - `validation.ts`: Zod-backed request validation errors.
  - `{resource}.ts`: Route handlers with inline OpenAPI operation specs.
- `src/schemas/`: Zod schemas, the single source of truth for both runtime
  validation and the generated OpenAPI spec.
  - `registry.ts`: Shared `zod-to-openapi` registry and `allOf` helpers.
  - `schemas.ts`, `geojson.ts`, `properties.ts`: Component schemas.
  - `parameters.ts`, `security.ts`: Reusable parameters and security schemes.
- `src/db/`
  - `index.ts`: Define database connection. Load `pg-promise` with repos:
  - `repos/`
    - `index.ts`: Compile all classes:
    - `{class}.ts`: Class definition with methods.
  - `sql/`
    - `index.ts`: Load all SQL query files:
    - `{class}/`
      - `*.sql`: Raw SQL with variable substitutions.
  - `generated/`: TypeScript row types derived from the live Postgres schema by
    [`kanel`](https://github.com/kristiandupont/kanel) (`public/{Table}.ts`).
    These are committed and consumed by repos/mappers for type-safe queries.
    Do not edit by hand; see [Database types](#database-types).

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

e2e tests require a database. `yarn test:e2e` spins one up, migrates, and runs them.

## Database types

Row types in `src/db/generated/` are derived from the live Postgres schema by
[`kanel`](https://github.com/kristiandupont/kanel) (configured in
`.kanelrc.cjs`). Each table yields a row interface, an `Initializer`, a
`Mutator`, and a branded id type, which repos and mappers consume for type-safe
queries instead of hand-written or `any`-typed rows.

Regenerate after any schema change (migration):

```sh
yarn db:types  # db:up + db:migrate + kanel, reading .env.test
```

The generated files are committed so that `yarn typecheck` works without a
running database. CI regenerates them against the migrated schema and fails if
the committed output is stale, so run `yarn db:types` and commit the result
whenever you add a migration.

Notes:

- `int8`/`bigint` columns map to `number` (matching the `INT8` type parser in
  `src/db/index.ts`); PostGIS `geometry`/`geography` map to `string` (GeoJSON,
  decoded in the mappers). See the overrides in `.kanelrc.cjs`.
- kanel prints harmless `Unknown type 'geometry' / 'double precision'` warnings
  for the PostGIS SQL functions; those routine wrappers are not consumed.

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

Build the spec, or build and validate it:

```sh
yarn build     # regenerate docs/openapi.yml
yarn validate  # build, then validate the result
```

Type-check the TypeScript sources:

```sh
yarn typecheck
```

Request bodies and path parameters are validated against the Zod schemas on
every request (invalid requests return `400`). Responses are not validated at
runtime; instead, each handler's return type is bound at compile time to its
documented 2xx response schema, so `yarn typecheck` catches response-shape
mismatches.
