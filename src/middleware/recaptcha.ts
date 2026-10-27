import type { Request, Response, NextFunction } from 'express'
import type { RecaptchaV2 } from 'express-recaptcha'

/** Request with the optional authenticated user and a mutable body. */
type RecaptchaRequest = Request & { user?: unknown }

function makeRecaptcha({ recaptcha }: { recaptcha: RecaptchaV2 | null }) {
  return function recaptcha_middleware(
    req: RecaptchaRequest,
    res: Response,
    next: NextFunction,
  ) {
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
        return void res.status(401).json({ error: `reCAPTCHA ${error}` })
      }
      return void next()
    })
  }
}

export = makeRecaptcha
