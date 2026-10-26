function makeCheckApiKey({db}) {
  return async function check_api_key(req, res, next) {
    const key = req.header('x-api-key') || req.query.api_key
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
}

module.exports = makeCheckApiKey
