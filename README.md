Falling Fruit API
=================

This is a Node.js + Express API that accesses the Falling Fruit PostgreSQL + PostGIS database served up at https://fallingfruit.org/api/. The API is currently (poorly) documented in a  [Google Doc](https://docs.google.com/document/d/1YMA_d6dT0IZjrJuN5ndz7jzrpSiuwFEsnGcqp9gKgo8/) but new documentation is on its way at https://github.com/falling-fruit/api-docs.

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

### Usage

Start the API:

```bash
pm2 start app.js
```

You can test the API by visiting http://localhost:3100/api/0.2/

Calls to the API will require an api_key parameter that matches an entry in the api_keys database table.
