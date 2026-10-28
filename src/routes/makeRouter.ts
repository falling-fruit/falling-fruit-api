import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import pgPromise from 'pg-promise'
import {
  compileRoute,
  registerOperation,
  type RouteSpec,
  type RequestSpec,
  type CompiledRoute,
  type InferParams,
  type InferQuery,
  type InferBody,
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

// The handler request: `params`, `query`, and `body` are inferred from the
// route spec's Zod schemas, which are the shapes validated at runtime. Query
// schemas coerce the raw wire strings to their logical types, so `query` is the
// coerced output type rather than raw Express strings.
type TypedReq<Params, Query, Body> = Omit<
  Request,
  'body' | 'query' | 'params'
> & {
  body: Body
  query: Query
  params: Params
  file?: any
  files?: any
}

// Request typed from a route spec's request block.
type SpecReq<Req extends RequestSpec> = TypedReq<
  InferParams<Req>,
  InferQuery<Req>,
  InferBody<Req>
>

// Request for a bare string path: no schema, so parts fall back to Express
// defaults and body to `any`.
type RawReq = TypedReq<
  Record<string, string>,
  Record<string, string | undefined>,
  any
>

type HandlerFor<Mode extends AuthMode, R> = Mode extends 'required'
  ? (
      req: R,
      user: User,
      res: Response,
      next: NextFunction,
    ) => unknown | Promise<unknown>
  : Mode extends 'optional'
    ? (
        req: R,
        user: User | null,
        res: Response,
        next: NextFunction,
      ) => unknown | Promise<unknown>
    : (
        req: R,
        res: Response,
        next: NextFunction,
      ) => unknown | Promise<unknown>

type SpecHandlers<Mode extends AuthMode, Req extends RequestSpec> = [
  ...any[],
  HandlerFor<Mode, SpecReq<Req>>,
]

type RawHandlers<Mode extends AuthMode> = [
  ...any[],
  HandlerFor<Mode, RawReq>,
]

type RouteArg = string | RouteSpec<RequestSpec>

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
        req.query = validateRequestPart(compiled.validate.query, req.query)
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
    const handler = handlers[handlers.length - 1] as HandlerFor<
      AuthMode,
      any
    >

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
              ? await (handler as HandlerFor<'none', any>)(req, res, next)
              : await (handler as HandlerFor<'optional', any>)(
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

  function get<Req extends RequestSpec, Mode extends AuthMode>(
    spec: RouteSpec<Req>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req>
  ): void
  function get<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function get(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('get', arg, auth, handlers)
  }

  function post<Req extends RequestSpec, Mode extends AuthMode>(
    spec: RouteSpec<Req>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req>
  ): void
  function post<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function post(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('post', arg, auth, handlers)
  }

  function put<Req extends RequestSpec, Mode extends AuthMode>(
    spec: RouteSpec<Req>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req>
  ): void
  function put<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function put(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('put', arg, auth, handlers)
  }

  // delete is a reserved word
  function drop<Req extends RequestSpec, Mode extends AuthMode>(
    spec: RouteSpec<Req>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req>
  ): void
  function drop<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function drop(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('delete', arg, auth, handlers)
  }

  return { router, get, post, put, drop }
}

export default makeRouter
module.exports = makeRouter
module.exports.default = makeRouter
