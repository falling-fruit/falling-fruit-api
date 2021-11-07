const db = require('./db')

let _ = {}

_.check_api_key = async function(req, res, next) {
  const key = req.header('x-api-key')
  if (!key) {
    return res.status(401).json({error: 'API key is missing'})
  }
  const matches = await db.any(
    "SELECT id FROM api_keys WHERE api_key=${key}", {key: key}
  )
  if (matches.length === 0) {
    return res.status(401).json({error: 'API key is invalid'})
  }
  next()
}

module.exports = _
