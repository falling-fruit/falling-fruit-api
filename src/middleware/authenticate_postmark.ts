import type { Request, Response, NextFunction } from 'express'

function makeAuthenticatePostmark({
  postmarkSecret,
}: {
  postmarkSecret: string | undefined
}) {
  return function authenticate_postmark(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    if (req.params.POSTMARK_SECRET !== postmarkSecret) {
      return void res.status(401).json({ error: 'Invalid secret' })
    }
    return void next()
  }
}

export default makeAuthenticatePostmark
