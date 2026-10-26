const makeCheckApiKey = require('./check_api_key')
const makeAuthenticate = require('./authenticate')
const makeAuthenticatePostmark = require('./authenticate_postmark')
const makeRecaptcha = require('./recaptcha')
const test_review = require('./test_review')

function makeMiddleware({db, tokenizer, recaptcha, postmarkSecret}) {
  return {
    check_api_key: makeCheckApiKey({db}),
    authenticate: makeAuthenticate({tokenizer}),
    authenticate_postmark: makeAuthenticatePostmark({postmarkSecret}),
    recaptcha: makeRecaptcha({recaptcha}),
    test_review
  }
}

module.exports = makeMiddleware
