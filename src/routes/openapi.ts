import type {
  RouteConfig,
  ResponseConfig,
} from '@asteasolutions/zod-to-openapi'
import { z, registry } from '../schemas/registry'

type Method = 'get' | 'post' | 'put' | 'delete'

type SecurityRequirement = Record<string, string[]>

export interface ResponseSpec {
  description: string
  schema?: z.ZodTypeAny
  mediaType?: string
  headers?: Record<string, any>
}

export interface RequestSpec {
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
  headers?: z.ZodTypeAny[]
  body?: {
    schema: z.ZodTypeAny
    mediaType?: string
    required?: boolean
    description?: string
  }
  // Optional overrides used ONLY for runtime validation (not OpenAPI).
  // Useful when the runtime-validated shape must differ from the documented
  // schema. When omitted, params, query, and body are validated from their
  // documented schemas.
  validateParams?: z.ZodTypeAny
  validateQuery?: z.ZodTypeAny
  validateBody?: z.ZodTypeAny
}

export interface RouteSpec<
  Req extends RequestSpec = RequestSpec,
  Responses extends Record<string, ResponseSpec> = Record<string, ResponseSpec>,
> {
  path: string
  summary?: string
  description?: string
  tags?: string[]
  security?: SecurityRequirement[]
  deprecated?: boolean
  request?: Req
  responses: Responses
}

// ---- Handler request-part inference
//
// The handler sees the runtime-validated shapes, which is what each route
// actually validates (see compileRoute): params from `validateParams ?? params`,
// body from `validateBody ?? body.schema`, and query from
// `validateQuery ?? query`. Query schemas coerce the raw wire strings to their
// logical types (see schemas/query.ts), so the handler receives coerced values.

type InferOutput<S> = S extends z.ZodType<infer Out> ? Out : unknown

/** Zod schema that validates path params for a route, if any. */
type ValidatedParamsSchema<Req extends RequestSpec> =
  Req['validateParams'] extends z.ZodTypeAny
    ? Req['validateParams']
    : Req['params'] extends z.ZodTypeAny
      ? Req['params']
      : undefined

/** Zod schema that validates the query string for a route, if any. */
type ValidatedQuerySchema<Req extends RequestSpec> =
  Req['validateQuery'] extends z.ZodTypeAny
    ? Req['validateQuery']
    : Req['query'] extends z.ZodTypeAny
      ? Req['query']
      : undefined

/** Zod schema that validates the JSON body for a route, if any. */
type ValidatedBodySchema<Req extends RequestSpec> =
  Req['validateBody'] extends z.ZodTypeAny
    ? Req['validateBody']
    : Req['body'] extends { schema: z.ZodTypeAny }
      ? Req['body']['schema']
      : undefined

export type InferParams<Req extends RequestSpec> =
  ValidatedParamsSchema<Req> extends z.ZodTypeAny
    ? InferOutput<ValidatedParamsSchema<Req>>
    : Record<string, string>

export type InferQuery<Req extends RequestSpec> =
  ValidatedQuerySchema<Req> extends z.ZodTypeAny
    ? InferOutput<ValidatedQuerySchema<Req>>
    : Record<string, string | undefined>

export type InferBody<Req extends RequestSpec> =
  ValidatedBodySchema<Req> extends z.ZodTypeAny
    ? InferOutput<ValidatedBodySchema<Req>>
    : any

export type SpecRequest<Spec> =
  Spec extends RouteSpec<infer Req, Record<string, ResponseSpec>>
    ? Req
    : RequestSpec

// ---- Handler response-body inference
type SuccessCode<Code> = Code extends `2${string}` ? Code : never

type SuccessResponseSchema<Responses> = {
  [Code in keyof Responses]: SuccessCode<Code> extends never
    ? never
    : Responses[Code] extends { schema: infer S }
      ? S
      : never
}[keyof Responses]

type IsAny<T> = 0 extends 1 & T ? true : false

export type InferResponseFromResponses<Responses> =
  SuccessResponseSchema<Responses> extends infer S
    ? IsAny<S> extends true
      ? unknown
      : [S] extends [z.ZodTypeAny]
        ? InferOutput<S>
        : unknown
    : unknown

export type InferResponse<Spec> =
  Spec extends RouteSpec<RequestSpec, infer Responses>
    ? InferResponseFromResponses<Responses>
    : unknown

export interface CompiledRoute {
  path: string
  validate: {
    params?: z.ZodTypeAny
    query?: z.ZodTypeAny
    body?: z.ZodTypeAny
  }
  openapi: Omit<RouteConfig, 'method' | 'path'>
}

const OPENAPI_PATH_PARAM = /:([A-Za-z0-9_]+)/g

export function expressPathToOpenApi(path: string): string {
  return path.replace(OPENAPI_PATH_PARAM, '{$1}')
}

function compileResponses(
  responses: Record<string, ResponseSpec>,
): RouteConfig['responses'] {
  const out: RouteConfig['responses'] = {}
  for (const [code, spec] of Object.entries(responses)) {
    const response: ResponseConfig = { description: spec.description }
    if (spec.headers) {
      response.headers = spec.headers
    }
    if (spec.schema) {
      response.content = {
        [spec.mediaType ?? 'application/json']: { schema: spec.schema },
      }
    }
    out[code] = response
  }
  return out
}

export function compileRoute(spec: RouteSpec): CompiledRoute {
  const request: NonNullable<RouteConfig['request']> = {}
  if (spec.request?.params) {
    request.params = spec.request.params as any
  }
  if (spec.request?.query) {
    request.query = spec.request.query as any
  }
  if (spec.request?.headers) {
    request.headers = spec.request.headers
  }
  if (spec.request?.body) {
    request.body = {
      required: spec.request.body.required,
      description: spec.request.body.description,
      content: {
        [spec.request.body.mediaType ?? 'application/json']: {
          schema: spec.request.body.schema,
        },
      },
    }
  }

  const responses = compileResponses(spec.responses)

  const openapi: Omit<RouteConfig, 'method' | 'path'> = {
    ...(spec.summary !== undefined ? { summary: spec.summary } : {}),
    ...(spec.description !== undefined
      ? { description: spec.description }
      : {}),
    ...(spec.tags !== undefined ? { tags: spec.tags } : {}),
    ...(spec.security !== undefined ? { security: spec.security } : {}),
    ...(spec.deprecated !== undefined ? { deprecated: spec.deprecated } : {}),
    ...(Object.keys(request).length ? { request } : {}),
    responses,
  }

  const bodyMediaType = spec.request?.body?.mediaType ?? 'application/json'
  const autoValidateBody =
    bodyMediaType === 'application/json'
      ? spec.request?.body?.schema
      : undefined

  return {
    path: spec.path,
    validate: {
      params: spec.request?.validateParams ?? spec.request?.params,
      query: spec.request?.validateQuery ?? spec.request?.query,
      body: spec.request?.validateBody ?? autoValidateBody,
    },
    openapi,
  }
}

export function registerOperation(
  method: Method,
  compiled: CompiledRoute,
): void {
  registry.registerPath({
    method,
    path: expressPathToOpenApi(compiled.path),
    ...compiled.openapi,
  })
}
