import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import pgPromise from 'pg-promise'
import {
  compileRoute,
  registerOperation,
  type RouteSpec,
  type CompiledRoute,
} from './openapi'
import {
  validateRequestPart,
  validateResponseBody,
  RequestValidationError,
  ResponseValidationError,
} from './validation'
import type makeAuth = require('../auth')

type AuthMode = makeAuth.AuthMode
type AuthSpec<Mode extends AuthMode> = makeAuth.AuthSpec<Mode>
type User = makeAuth.User

const { queryResultErrorCode } = pgPromise.errors

const STRICT_RESPONSE_VALIDATION =
  process.env.STRICT_RESPONSE_VALIDATION === 'true'

type Method = 'get' | 'post' | 'put' | 'delete'

type Req = Omit<Request, 'body' | 'query' | 'params'> & {
  body: any
  query: any
  params: any
  file?: any
  files?: any
}

type FinalHandler<Mode extends AuthMode> = Mode extends 'required'
  ? (
      req: Req,
      user: User,
      res: Response,
      next: NextFunction,
    ) => unknown | Promise<unknown>
  : Mode extends 'optional'
    ? (
        req: Req,
        user: User | null,
        res: Response,
        next: NextFunction,
      ) => unknown | Promise<unknown>
    : (
        req: Req,
        res: Response,
        next: NextFunction,
      ) => unknown | Promise<unknown>

type RouteHandlers<Mode extends AuthMode> = [...any[], FinalHandler<Mode>]

type RouteArg = string | RouteSpec

function makeValidationMiddleware(compiled: CompiledRoute) {
  return (req: any, res: any, next: any) => {
    try {
      if (compiled.validate.params) {
        req.params = validateRequestPart(
          compiled.validate.params,
          req.params,
        ) as any
      }
      if (compiled.validate.query) {
        const validated = validateRequestPart(
          compiled.validate.query,
          req.query,
        )
        ;(req as any).validatedQuery = validated
        Object.assign(req.query, validated as any)
      }
      if (compiled.validate.body) {
        req.body = validateRequestPart(compiled.validate.body, req.body)
      }
      return void next()
    } catch (err) {
      if (err instanceof RequestValidationError) {
        return void res.status(400).json({ error: err.message })
      }
      return void next(err)
    }
  }
}

function makeRouter() {
  const router = express.Router({ mergeParams: true })

  function register_route(
    method: Method,
    arg: RouteArg,
    auth: AuthSpec<AuthMode>,
    handlers: any[],
  ) {
    const path = typeof arg === 'string' ? arg : arg.path
    const compiled: CompiledRoute | undefined =
      typeof arg === 'string' ? undefined : compileRoute(arg)

    const preHandlers = handlers.slice(0, -1) as any[]
    const handler = handlers[handlers.length - 1] as FinalHandler<AuthMode>

    if (compiled) {
      registerOperation(method, compiled)
    }

    const middleware: any[] = []
    if (
      compiled &&
      (compiled.validate.params ||
        compiled.validate.query ||
        compiled.validate.body)
    ) {
      middleware.push(makeValidationMiddleware(compiled))
    }
    middleware.push(...(auth?.handlers ?? []))
    middleware.push(...preHandlers)

    ;(router[method] as any)(
      path,
      ...middleware,
      async (req: any, res: any, next: any) => {
        try {
          const user: User | null = req.user ?? null
          const data =
            auth.mode === 'none'
              ? await (handler as FinalHandler<'none'>)(req, res, next)
              : await (handler as FinalHandler<'optional'>)(
                  req,
                  user,
                  res,
                  next,
                )
          if (data) {
            let body: unknown = data
            if (compiled?.responseBody && !res.headersSent) {
              try {
                body = validateResponseBody(compiled.responseBody, data)
              } catch (err) {
                if (
                  STRICT_RESPONSE_VALIDATION &&
                  err instanceof ResponseValidationError
                ) {
                  throw err
                }
                if (err instanceof ResponseValidationError) {
                  console.warn(
                    `[response validation] ${method.toUpperCase()} ${path}: ${err.message}`,
                  )
                }
                body = data
              }
            }
            if (!res.headersSent) {
              return void res.status(200).json(body)
            }
          }
        } catch (err: any) {
          console.log('[caught]', err || err.message)
          if (err instanceof RequestValidationError) {
            return void res.status(400).json({ error: err.message })
          }
          if (err instanceof ResponseValidationError) {
            return void res
              .status(500)
              .json({ error: 'Response validation failed' })
          }
          if (method === 'get' && err.code === queryResultErrorCode.noData) {
            return void res.status(404).json({ error: 'Not found' })
          }
          return void res.status(400).json({ error: err.message || err })
        }
      },
    )
  }

  function get<Mode extends AuthMode>(
    arg: RouteArg,
    auth: AuthSpec<Mode>,
    ...handlers: RouteHandlers<Mode>
  ) {
    register_route('get', arg, auth, handlers)
  }

  function post<Mode extends AuthMode>(
    arg: RouteArg,
    auth: AuthSpec<Mode>,
    ...handlers: RouteHandlers<Mode>
  ) {
    register_route('post', arg, auth, handlers)
  }

  function put<Mode extends AuthMode>(
    arg: RouteArg,
    auth: AuthSpec<Mode>,
    ...handlers: RouteHandlers<Mode>
  ) {
    register_route('put', arg, auth, handlers)
  }

  // delete is a reserved word
  function drop<Mode extends AuthMode>(
    arg: RouteArg,
    auth: AuthSpec<Mode>,
    ...handlers: RouteHandlers<Mode>
  ) {
    register_route('delete', arg, auth, handlers)
  }

  return { router, get, post, put, drop }
}

export default makeRouter
module.exports = makeRouter
module.exports.default = makeRouter
