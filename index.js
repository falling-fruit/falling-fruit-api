const db = require('./db');
const express = require('express');
const app = express();
_ = require('./helpers');

// Routes
GET_with_key('/clusters/cluster', req => db.clusters.cluster(req.query));
GET_with_key('/types/find/:id', req => db.types.findById(req.params.id));
GET_with_key('/types/all', req => db.types.all());
GET_with_key('/types/cluster', req => db.types.cluster(req.query));

// Generic handlers
function GET(url, handler) {
  app.get(url, (req, res) => {
    handler(req)
      .then(data => {
        res.status(200).json(
          data
        );
      })
      .catch(error => {
        res.status(400).json({
          error: error.message || error
        });
      });
  });
}

function GET_with_key(url, handler) {
  GET(url, req => check_api_key(req, handler))
}

function check_api_key(req, handler) {
  return db.task(t => {
    return t.any("SELECT id FROM api_keys WHERE api_key=${api_key};", req.query)
      .then(keys => {
        if (keys.length == 0) {
          throw Error('api_key is invalid');
        }
        return handler(req, t);
      })
  });
}

// Start server
const port = 3100;
app.listen(port, () => {
    console.log('Ready for GET requests on http://localhost:' + port);
});
