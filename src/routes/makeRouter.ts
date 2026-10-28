import express from 'express'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
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
  type InferResponseFromResponses,
  type ResponseSpec,
} from './openapi'
import {
  validateRequestPart,
  RequestValidationError,
} from './validation'
import type {
  AuthMode as _AuthMode,
  AuthSpec as _AuthSpec,
  User as _User,
  AuthRequest as _AuthRequest,
} from '../auth'

type AuthMode = _AuthMode
type AuthSpec<Mode extends AuthMode> = _AuthSpec<Mode>
type User = _User
type AuthRequest = _AuthRequest

const { queryResultErrorCode } = pgPromise.errors

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

type HandlerResult<Res> = Res | void | undefined

type HandlerFor<Mode extends AuthMode, R, Res> = Mode extends 'required'
  ? (
      req: R,
      user: User,
      res: Response,
      next: NextFunction,
    ) => HandlerResult<Res> | Promise<HandlerResult<Res>>
  : Mode extends 'optional'
    ? (
        req: R,
        user: User | null,
        res: Response,
        next: NextFunction,
      ) => HandlerResult<Res> | Promise<HandlerResult<Res>>
    : (
        req: R,
        res: Response,
        next: NextFunction,
      ) => HandlerResult<Res> | Promise<HandlerResult<Res>>

type SpecHandlers<
  Mode extends AuthMode,
  Req extends RequestSpec,
  Responses extends Record<string, ResponseSpec>,
> = [
  ...any[],
  HandlerFor<Mode, SpecReq<Req>, InferResponseFromResponses<Responses>>,
]

type RawHandlers<Mode extends AuthMode> = [
  ...any[],
  HandlerFor<Mode, RawReq, unknown>,
]

type RouteArg = string | RouteSpec<RequestSpec>

function makeValidationMiddleware(compiled: CompiledRoute): RequestHandler {
  return (req, res, next) => {
    try {
      if (compiled.validate.params) {
        req.params = validateRequestPart(
          compiled.validate.params,
          req.params,
        ) as typeof req.params
      }
      if (compiled.validate.query) {
        req.query = validateRequestPart(
          compiled.validate.query,
          req.query,
        ) as typeof req.query
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

    const preHandlers = handlers.slice(0, -1) as RequestHandler[]
    const handler = handlers[handlers.length - 1] as HandlerFor<
      AuthMode,
      any,
      any
    >

    if (compiled) {
      registerOperation(method, compiled)
    }

    const middleware: RequestHandler[] = []
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
      async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
          const user: User | null = req.user ?? null
          const data =
            auth.mode === 'none'
              ? await (handler as HandlerFor<'none', any, any>)(req, res, next)
              : await (handler as HandlerFor<'optional', any, any>)(
                  req,
                  user,
                  res,
                  next,
                )
          if (data) {
            if (!res.headersSent) {
              return void res.status(200).json(data)
            }
          }
        } catch (err: any) {
          console.log('[caught]', err || err.message)
          if (err instanceof RequestValidationError) {
            return void res.status(400).json({ error: err.message })
          }
          if (method === 'get' && err.code === queryResultErrorCode.noData) {
            return void res.status(404).json({ error: 'Not found' })
          }
          return void res.status(400).json({ error: err.message || err })
        }
      },
    )
  }

  function get<
    Req extends RequestSpec,
    Responses extends Record<string, ResponseSpec>,
    Mode extends AuthMode,
  >(
    spec: RouteSpec<Req, Responses>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req, Responses>
  ): void
  function get<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function get(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('get', arg, auth, handlers)
  }

  function post<
    Req extends RequestSpec,
    Responses extends Record<string, ResponseSpec>,
    Mode extends AuthMode,
  >(
    spec: RouteSpec<Req, Responses>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req, Responses>
  ): void
  function post<Mode extends AuthMode>(
    path: string,
    auth: AuthSpec<Mode>,
    ...handlers: RawHandlers<Mode>
  ): void
  function post(arg: RouteArg, auth: AuthSpec<AuthMode>, ...handlers: any[]) {
    register_route('post', arg, auth, handlers)
  }

  function put<
    Req extends RequestSpec,
    Responses extends Record<string, ResponseSpec>,
    Mode extends AuthMode,
  >(
    spec: RouteSpec<Req, Responses>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req, Responses>
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
  function drop<
    Req extends RequestSpec,
    Responses extends Record<string, ResponseSpec>,
    Mode extends AuthMode,
  >(
    spec: RouteSpec<Req, Responses>,
    auth: AuthSpec<Mode>,
    ...handlers: SpecHandlers<Mode, Req, Responses>
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
