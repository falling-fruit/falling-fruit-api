function authenticate_postmark(req, res, next) {
  if (req.params.POSTMARK_SECRET !== process.env.POSTMARK_SECRET) {
    return void res.status(401).json({error: 'Invalid secret'})
  }
  return void next()
}

module.exports = authenticate_postmark
