// globals
config = require('./config');
db = require('./db');
async = require("async");
__ = require("underscore");
_s = require("underscore.string");
common = require('./common');

// locals
var express = require('express');
var router = express.Router();
//var apicache = require('apicache').options({ debug: true }).middleware;
var multer = require('multer');
var app = express();

app.use(multer({ dest: config.temp_dir }));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  console.log("REQUEST: " + req.originalUrl);
  next();
});

// TODO: GET /locations/mine.json - 0.3

// Note: /locations/marker.json is now obsolete (covered by /locations/:id.json)
// Note: /locations/nearby.json is now obsolete (covered by /locations.json)

// Routes
var auth = require('./auth');
var types = require('./types');
var locations = require('./locations');
var clusters = require('./clusters');
var reviews = require('./reviews');

var users = require('./users');
router.post('/users.json', users.add);

// Note: takes email/password, returns authentication_token (in hash) -- protocol may have changed
router.get('/login.json',auth.login);
router.get('/logout.json',auth.logout);

// Note: grid parameter replaced by zoom
// Note: now can accept a bounding box, deprecating the cluster_types.json endpoint
//router.get('/types.json',apicache('1 hour'),types.list);
router.get('/types.json', types.list);
// Note: renaming name => en_name, synonyms => en_synonyms, edability => edibility
router.get('/types/:id(\\d+).json', types.show);
router.get('/types/counts.json', types.count);

// Note: GET /locations.json replaces both /markers.json and nearby.json
// Note: types renamed to type_ids
// Note: n renamed to limit
// Note: name (string) replaced with type_names (array)
// Note: title removed (client can create from type_names)
// Note: can take lat/lng to obviate need for nearby.json
// Note: returns only the most recent photo, not an array of photos
// FIXME: does not include child types, leaves it to the client to do that with t argument
router.get('/locations.json', locations.list);
// NOTE: title has been replaced with type_names
router.get('/locations/:id(\\d+).json', locations.show);
// Note: only logs change as addition (not review too, when both are done)
router.post('/locations.json',locations.add);
router.post('/locations/:id(\\d+).json',locations.edit);

// Note: grid param renamed to zoom
// Note: does not implicitly include children, we leave that to the client
// Note: does not return title, client is responsible for formatting (i.e., calling number_to_human)
router.get('/clusters.json', clusters.list);

router.get('/locations/:id(\\d+)/reviews.json', reviews.list);
// Note: only logs change as addition (not review too, when both are done)
router.post('/locations/:id(\\d+)/review.json',reviews.add);

app.use("/test-api/"+config.version,router);

var server = app.listen(config.port, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Falling Fruit API listening at http://%s:%s', host, port);

});
