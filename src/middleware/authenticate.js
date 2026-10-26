function makeAuthenticate({tokenizer}) {
  function get_user_from_token(req, res, next) {
    const header = req.header('authorization')
    if (!header) {
      return void next()
    }
    if (!header.toLowerCase().startsWith('bearer ')) {
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({error: 'Invalid access token'})
    }
    const token = header.substring(7)
    const data = tokenizer.verify_access(token, res)
    if (data) {
      req.user = data
      return void next()
    }
  }

  function require_user(role = 'user') {
    return function(req, res, next) {
      if (!req.user) {
        // Phrase: similar to devise.failure.unauthenticated
        return void res.status(403).json({error: 'Token is required but missing'})
      }
      if (!req.user.roles.includes(role)) {
        // Phrase: not found
        return void res.status(403).json({error: 'Insufficient permissions'})
      }
      return void next()
    }
  }

  function authenticate(role) {
    if (role) {
      return [get_user_from_token, require_user(role)]
    }
    return [get_user_from_token]
  }

  return authenticate
}

module.exports = makeAuthenticate
