# Falling Fruit Test API

Exploratory attempt to rewrite and simplify the Falling Fruit NodeJS API using [express](https://github.com/expressjs/express), [pg-promise](https://github.com/vitaly-t/pg-promise), and [bluebird](https://github.com/petkaantonov/bluebird). The code structure is inspired by this [pg-promise demo](https://github.com/vitaly-t/pg-promise-demo) and this more general [tutorial](http://mherman.org/blog/2016/03/13/designing-a-restful-api-with-node-and-postgres/#.WgOMrhNSyEI).

You can browse the OpenAPI definition for the main branch [here](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/falling-fruit/api/main/docs/openapi.yml), and for the live API [here](https://petstore.swagger.io/?url=https://fallingfruit.org/test-api/0.3/openapi.yml).

### File structure

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

## Development

### Installation

1. Install [Node JS](https://nodejs.org/)
2. Clone this repo, `cd` into the directory, and install node modules:

```bash
git clone https://github.com/falling-fruit/api.git
cd api
npm install
```

3. Copy `.env.example` to `.env` and update the values as needed.

```bash
cp .env.example .env
```

### Usage

1. Run `npm start`
2. Visit http://localhost:3300

## Core Schema (draft)

Attributes common to all models:

- `id`
- `created_at`
- `updated_at`

### Locations

- `lng`, `lat`, `address`
- `import_id`
- `original_ids`
- `user_id`
- `author`
- `type_ids`
- `description`
- `access`
- `unverified`
- ~~`season_start`, `season_stop`, `no_season`~~: Consider replacing with equivalent fields in `Observations`

Dependent attributes:

- `city`, `state`, `country`: Computed from `lng`, `lat` and cached.
- `muni`: Computed from `import_id` and cached.
- `invasive`: Computed from `Invasives.regions` and cached.

### Imports

- `name`
- `url`
- `license`
- `comments`
- `muni`
- `default_category_mask`
- ~~`autoload`~~: Not needed.
- ~~`auto_cluster`~~: Clustering is now fast, so may no longer be needed.
- ~~`reverse_geocode`~~: Not needed. `Locations` with `address` but missing `lng`, `lat` are automatically reverse geocoded.

### Types

- `parent_id`
- `pending`
- `taxonomic_rank`
- ~~`scientific_*`~~: Replace with `scientific_names`.
- ~~`*_name`~~: Replace with `common_names` (by locale).
- ~~`*_url`~~: Replace with `urls` (by locale).
- ~~`usda_symbol`~~: Migrate to `urls`.
- `notes`
- ~~`edibility`~~: Remove or expand scale.
- ~~`category_mask`~~: Replace with more flexible `TypeFilters`.

### TypeFilters [new]

- `name`
- `user_id`
- `public`
- `type_ids`

### Observations

- `location_id`
- `user_id`, `remote_ip`, `author`
- `observed_on`
- `comment`
- ~~`photo_*`~~: Replace with `photos`.
- ~~`fruiting`~~: Replace with `type_id`, `season_start`, `season_stop`, `no_season`, `status`, `yield`, ...
- `quality_rating`
- `yield_rating`
- `graft`
