const makeCheckApiKey = require('./check_api_key')
const makeAuthenticate = require('./authenticate')
const authenticate_postmark = require('./authenticate_postmark')
const recaptcha = require('./recaptcha')
const test_review = require('./test_review')

function makeMiddleware({db, tokenizer}) {
  return {
    check_api_key: makeCheckApiKey({db}),
    authenticate: makeAuthenticate({tokenizer}),
    authenticate_postmark,
    recaptcha,
    test_review
  }
}

module.exports = makeMiddleware
