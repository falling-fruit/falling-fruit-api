const db = require('./db');
const express = require('express');
const cors = require('cors');
const multer = require('multer')
const uploader = multer({ dest: 'uploads' })
_ = require('./helpers');

const app = express();
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const base = '/test-api/0.3'
GET_with_key(`${base}/clusters`, req => db.clusters.list(req.query));
GET_with_key(`${base}/types`, () => db.types.list());
GET_with_key(`${base}/types/:id`, req => db.types.show(req.params.id));
GET_with_key(`${base}/types/cluster`, req => db.types.list(req.query));
GET_with_key(`${base}/locations`, req => db.locations.list(req.query));
GET_with_key(`${base}/locations/count`, req => db.locations.count(req.query));
POST(`${base}/locations`, uploader.none(), req => db.locations.add(req.body));
GET_with_key(`${base}/locations/:id`, req => db.locations.show(req.params.id));

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

function POST(url, uploader, handler) {
  app.post(url, uploader, (req, res) => {
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
  GET(url, req => check_key(req, handler))
}

function check_key(req, handler) {
  return db.any("SELECT id FROM api_keys WHERE api_key=${key};", req.query)
    .then(keys => {
      if (keys.length == 0) {
        throw Error('key is invalid');
      }
      return handler(req, handler);
    })
}

// Start server
const port = 3300;
app.listen(port, () => {
    console.log('Ready for GET requests on http://localhost:' + port);
});
