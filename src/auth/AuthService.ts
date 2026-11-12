import type { Response, NextFunction, RequestHandler } from 'express'
import type Tokenizer from '../tokens'
import type { AuthRequest, AuthSpec } from './index'

class AuthService {
  private readonly tokenizer: Tokenizer

  constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer
  }

  private get_user_from_token = (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) => {
    const header = req.header('authorization')
    if (!header) {
      return void next()
    }
    if (!header.toLowerCase().startsWith('bearer ')) {
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({ error: 'Invalid access token' })
    }
    const token = header.substring(7)
    const data = this.tokenizer.verify_access(token, res)
    if (data) {
      req.user = data
      return void next()
    }
  }

  private require_user(role: string): RequestHandler {
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

  required_role(role: string): AuthSpec<'required'> {
    return {
      mode: 'required',
      handlers: [
        this.get_user_from_token as RequestHandler,
        this.require_user(role),
      ],
    }
  }

  get optional(): AuthSpec<'optional'> {
    return {
      mode: 'optional',
      handlers: [this.get_user_from_token as RequestHandler],
    }
  }

  get none(): AuthSpec<'none'> {
    return {
      mode: 'none',
      handlers: [],
    }
  }
}

export default AuthService
