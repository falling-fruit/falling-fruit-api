![Status](https://img.shields.io/badge/Status-Actively%20developed-darkgreen.svg?style=flat-square)

Falling Fruit API
=================

NodeJS API using [express](https://github.com/expressjs/express), [pg-promise](https://github.com/vitaly-t/pg-promise), and [bluebird](https://github.com/petkaantonov/bluebird). The code structure is inspired by this [pg-promise demo](https://github.com/vitaly-t/pg-promise-demo) and this more general [tutorial](http://mherman.org/blog/2016/03/13/designing-a-restful-api-with-node-and-postgres/#.WgOMrhNSyEI).

You can browse the OpenAPI definition for the main branch [here](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/falling-fruit/api/main/docs/openapi.yml), and for the live API [here](https://petstore.swagger.io/?url=https://fallingfruit.org/api/0.3/openapi.yml).

# Status

Live at https://fallingfruit.org/api/0.3. Used by https://fallingfruit.org ([falling-fruit](https://github.com/falling-fruit/falling-fruit)) and extensively by https://beta.fallingfruit.org ([falling-fruit-web](https://github.com/falling-fruit/falling-fruit-web)).

# Layout

- `index.js`: Define routes and generic handlers. Start server.
- `helpers.js`: Define helper functions.
- `db/`
  - `index.js`: Define database connection. Load `pg-promise` with repos:
  - `repos/`
    - `index.js`: Compile all classes:
    - `{class}.js`: Class definition with methods.
  - `sql/`
    - `index.js`: Load all SQL query files:
    - `{class}/`
      - `*.sql`: Raw SQL with variable substitutions.

# Development

## Installation

1. Install [Node JS](https://nodejs.org/)
2. Install [Yarn](https://classic.yarnpkg.com/lang/en/docs/install)
3. Clone this repo, `cd` into the directory, and install node modules:

```bash
git clone https://github.com/falling-fruit/api.git
cd api
yarn
```

4. Copy `.env.example` to `.env` and update the values as needed.

```bash
cp .env.example .env
```

## Usage

```sh
yarn start
```

Visit http://localhost:3300.

## Documentation

Validate and build the OpenAPI documentation:

```sh
yarn validate && yarn build
```
