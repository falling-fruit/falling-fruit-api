import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type Tokenizer from '../tokens'

/** The authenticated user attached to the request. */
type AuthUser = { id: number; roles: string[]; exp: number; jti: string }

/** Request with an optional authenticated user. */
type AuthRequest = Request & { user?: AuthUser }

function makeAuthenticate({ tokenizer }: { tokenizer: Tokenizer }) {
  function get_user_from_token(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    const header = req.header('authorization')
    if (!header) {
      return void next()
    }
    if (!header.toLowerCase().startsWith('bearer ')) {
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({ error: 'Invalid access token' })
    }
    const token = header.substring(7)
    const data = tokenizer.verify_access(token, res)
    if (data) {
      req.user = data
      return void next()
    }
  }

  function require_user(role = 'user'): RequestHandler {
    return function (req: AuthRequest, res, next) {
      if (!req.user) {
        // Phrase: similar to devise.failure.unauthenticated
        return void res
          .status(403)
          .json({ error: 'Token is required but missing' })
      }
      if (!req.user.roles.includes(role)) {
        // Phrase: not found
        return void res.status(403).json({ error: 'Insufficient permissions' })
      }
      return void next()
    }
  }

  function authenticate(role?: string): RequestHandler[] {
    if (role) {
      return [get_user_from_token as RequestHandler, require_user(role)]
    }
    return [get_user_from_token as RequestHandler]
  }

  return authenticate
}

export = makeAuthenticate
