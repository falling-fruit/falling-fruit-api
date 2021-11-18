const db = require('./db')
const tokenizer = new (require('./tokens'))()

const _ = {}

_.check_api_key = async function(req, res, next) {
  // TODO: Store API keys hashed with prefix
  // TODO: Move API keys from db to config
  const key = req.header('x-api-key')
  if (!key) {
    return void res.status(401).json({error: 'API key is missing'})
  }
  const matches = await db.any(
    'SELECT id FROM api_keys WHERE api_key=${key}', {key: key}
  )
  if (matches.length === 0) {
    return void res.status(401).json({error: 'API key is invalid'})
  }
  return void next()
}

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
  const user = tokenizer.verify_access(token, res)
  if (user) {
    req.user = user
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

_.authenticate = function(role) {
  if (role) {
    return [get_user_from_token, require_user(role)]
  }
  return [get_user_from_token]
}

module.exports = _
