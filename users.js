const common = require("./common");

var users = {};
users.bcrypt = require("bcrypt-nodejs");

users.add = function (req, res) {
  if (!__.every([req.query.email, req.query.password])) {
    common.send_error(res, "Email or password are not defined.")
  }
  var token = common.generate_auth_token()
  db.pg.connect(db.conString, function(err, client, done) {
    if (err) {
      common.send_error(res, "Error fetching client from pool.", err);
      return done();
    }
    async.waterfall([
      function(callback) {
        common.check_api_key(req, client, callback);
      },
      function(callback) {
        // Skip email confirmation by setting authentication token
        client.query(
          "INSERT INTO users (\
          email, encrypted_password, name, add_anonymously, authentication_token, \
          created_at, updated_at \
          ) \
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
          [
            req.query.email,
            users.bcrypt.hashSync(req.query.password),
            req.query.name,
            Boolean(req.query.add_anonymously),
            token
          ],
          function(err) {
            if (err) return callback(err, err.detail);
            return callback(null);
          }
        );
      },
      function(callback) {
        res.send({"auth_token": token});
        return callback(null);
      }
    ],
    function(err, message) {
      done();
      if (message) common.send_error(res, message, err);
    });
  });
}

module.exports = users;
