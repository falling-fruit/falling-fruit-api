Falling Fruit API
=================

This is a Node.js + Express API that currently accesses the Falling Fruit PostgreSQL + PostGIS test database served up at https://fallingfruit.org/test-api/0.2.
The API is documented at https://github.com/falling-fruit/api-docs.

## Development

### Installation

* Initialize the Falling Fruit database (see https://github.com/falling-fruit/falling-fruit)
* Install Node Version Manager (see https://github.com/creationix/nvm)
* Install Node (0.12):

```bash
nvm install 0.12
nvm use 0.12
```

* Node packages:

```bash
npm install
```

* Initialize configuration files:

```bash
cp database.yml.dist database.yml
cp s3.yml.dist s3.yml
```

Edit `database.yml` with your development database, username, and password.
You will need to add Amazon S3 credentials to `s3.yml`.

### Usage

Start the API:

```bash
pm2 start app.js
```

Calls to the API will require an `api_key` query parameter that matches an entry in the `api_keys` database table.
