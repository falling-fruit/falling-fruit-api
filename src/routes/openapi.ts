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

export interface RouteSpec {
  path: string
  summary?: string
  description?: string
  tags?: string[]
  security?: SecurityRequirement[]
  deprecated?: boolean
  request?: {
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
    // Useful when query params need coercion that differs from the
    // documented schema. If omitted, params and body are validated from
    // their documented schemas; query is not validated unless set here.
    validateParams?: z.ZodTypeAny
    validateQuery?: z.ZodTypeAny
    validateBody?: z.ZodTypeAny
  }
  responses: Record<string, ResponseSpec>
}

export interface CompiledRoute {
  path: string
  validate: {
    params?: z.ZodTypeAny
    query?: z.ZodTypeAny
    body?: z.ZodTypeAny
  }
  responseBody?: z.ZodTypeAny
  openapi: Omit<RouteConfig, 'method' | 'path'>
}

const OPENAPI_PATH_PARAM = /:([A-Za-z0-9_]+)/g

export function expressPathToOpenApi(path: string): string {
  return path.replace(OPENAPI_PATH_PARAM, '{$1}')
}

function compileResponses(
  responses: Record<string, ResponseSpec>,
): { openapi: RouteConfig['responses']; successBody?: z.ZodTypeAny } {
  const out: RouteConfig['responses'] = {}
  let successBody: z.ZodTypeAny | undefined
  for (const [code, spec] of Object.entries(responses)) {
    const response: ResponseConfig = { description: spec.description }
    if (spec.headers) {
      response.headers = spec.headers
    }
    if (spec.schema) {
      response.content = {
        [spec.mediaType ?? 'application/json']: { schema: spec.schema },
      }
      if (code.startsWith('2') && !successBody) {
        successBody = spec.schema
      }
    }
    out[code] = response
  }
  return { openapi: out, successBody }
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
    request.headers = spec.request.headers as any
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

  const { openapi: responses, successBody } = compileResponses(spec.responses)

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
      query: spec.request?.validateQuery,
      body: spec.request?.validateBody ?? autoValidateBody,
    },
    responseBody: successBody,
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
