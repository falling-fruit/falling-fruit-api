function makeAuthenticatePostmark({ postmarkSecret }) {
  return function authenticate_postmark(req, res, next) {
    if (req.params.POSTMARK_SECRET !== postmarkSecret) {
      return void res.status(401).json({error: 'Invalid secret'})
    }
    return void next()
  }
}

module.exports = makeAuthenticatePostmark
