const promise = require('bluebird');
const repos = require('./repos');
const yaml = require('yaml');
const fs = require('fs');

const options = {
  promiseLib: promise,
  extend: (obj, dc) => {
    obj.clusters = new repos.Clusters(obj, pgp);
    obj.types = new repos.Types(obj, pgp);
    obj.locations = new repos.Locations(obj, pgp);
    obj.reviews = new repos.Reviews(obj, pgp);
  }
};
const pgp = require('pg-promise')(options);
const config = yaml.parse(fs.readFileSync('config.yml', 'utf8'));
const db = pgp(config);
module.exports = db;
