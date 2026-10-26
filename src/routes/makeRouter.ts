import express from 'express'
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

const { queryResultErrorCode } = pgPromise.errors

const STRICT_RESPONSE_VALIDATION =
  process.env.STRICT_RESPONSE_VALIDATION === 'true'

type Method = 'get' | 'post' | 'put' | 'delete'

type Handler = (
  req: any,
  res: any,
  next: any,
) => unknown | Promise<unknown>

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

  function register_route(method: Method, arg: RouteArg, handlers: Handler[]) {
    const path = typeof arg === 'string' ? arg : arg.path
    const compiled: CompiledRoute | undefined =
      typeof arg === 'string' ? undefined : compileRoute(arg)

    const preHandlers = handlers.slice(0, -1) as any[]
    const handler = handlers[handlers.length - 1]

    if (compiled) {
      registerOperation(method, compiled)
    }

    const middleware: any[] = []
    if (compiled && (compiled.validate.params || compiled.validate.query || compiled.validate.body)) {
      middleware.push(makeValidationMiddleware(compiled))
    }
    middleware.push(...preHandlers)

    ;(router[method] as any)(
      path,
      ...middleware,
      async (req: any, res: any, next: any) => {
        try {
          const data = await handler(req, res, next)
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

  function get(arg: RouteArg, ...handlers: Handler[]) {
    register_route('get', arg, handlers)
  }

  function post(arg: RouteArg, ...handlers: Handler[]) {
    register_route('post', arg, handlers)
  }

  function put(arg: RouteArg, ...handlers: Handler[]) {
    register_route('put', arg, handlers)
  }

  // delete is a reserved word
  function drop(arg: RouteArg, ...handlers: Handler[]) {
    register_route('delete', arg, handlers)
  }

  return { router, get, post, put, drop }
}

export default makeRouter
module.exports = makeRouter
module.exports.default = makeRouter
