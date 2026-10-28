import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type Tokenizer from './tokens'

function makeAuth({ tokenizer }: { tokenizer: Tokenizer }) {
  function get_user_from_token(
    req: makeAuth.AuthRequest,
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

  function require_user(role: string): RequestHandler {
    return function (req: makeAuth.AuthRequest, res, next) {
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

  function required_role(role: string): makeAuth.AuthSpec<'required'> {
    return {
      mode: 'required',
      handlers: [get_user_from_token as RequestHandler, require_user(role)],
    }
  }

  const optional: makeAuth.AuthSpec<'optional'> = {
    mode: 'optional',
    handlers: [get_user_from_token as RequestHandler],
  }

  const none: makeAuth.AuthSpec<'none'> = {
    mode: 'none',
    handlers: [],
  }

  return { required_role, optional, none }
}

namespace makeAuth {
  /** The authenticated user attached to the request. */
  export type User = { id: number; roles: string[]; exp: number; jti: string }

  /** Request carrying the (optionally) authenticated user resolved by auth. */
  export type AuthRequest = Request & { user?: User }

  /** How a route resolves the authenticated user. */
  export type AuthMode = 'required' | 'optional' | 'none'

  /**
   * A typed authentication specification passed as the second argument to a
   * router method. The phantom `mode` determines the final handler signature:
   * - `required`: handler receives a guaranteed `User`.
   * - `optional`: handler receives `User | null`.
   * - `none`: handler receives no user argument.
   */
  export interface AuthSpec<Mode extends AuthMode> {
    mode: Mode
    handlers: RequestHandler[]
  }

  /** The auth service: constructors of typed auth specs. */
  export type Auth = ReturnType<typeof makeAuth>
}

export = makeAuth
