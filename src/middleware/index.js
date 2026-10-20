const middleware = {}

middleware.check_api_key = require('./check_api_key')
middleware.authenticate = require('./authenticate')
middleware.authenticate_postmark = require('./authenticate_postmark')
middleware.recaptcha = require('./recaptcha')
middleware.test_review = require('./test_review')

module.exports = middleware
