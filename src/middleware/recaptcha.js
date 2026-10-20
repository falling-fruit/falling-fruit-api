const Recaptcha = require('express-recaptcha').RecaptchaV2
const recaptcha = process.env.RECAPTCHA_DISABLED
  ? null
  : new Recaptcha(
      process.env.RECAPTCHA_SITE_KEY,
      process.env.RECAPTCHA_SECRET_KEY
    )

function recaptcha_middleware(req, res, next) {
  if (req.user || !recaptcha) {
    return void next()
  }
  const header = req.header('g-recaptcha-response')
  if (header) {
    req.body = req.body || {}
    req.body['g-recaptcha-response'] = header
  }
  recaptcha.verify(req, (error) => {
    if (error) {
      return void res.status(401).json({error: `reCAPTCHA ${error}`})
    }
    return void next()
  })
}

module.exports = recaptcha_middleware
