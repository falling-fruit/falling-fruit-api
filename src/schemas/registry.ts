import { z } from 'zod'
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

export { z }

export function register<T extends z.ZodTypeAny>(id: string, schema: T): T {
  const described = schema.openapi(id) as T
  registry.register(id, described)
  return described
}

export function inlineAllOf(members: z.ZodTypeAny[]): z.ZodTypeAny {
  const [first, ...rest] = members
  return rest.reduce<z.ZodTypeAny>(
    (acc, member) => z.intersection(acc, member),
    first,
  )
}

export function allOf(
  id: string,
  members: z.ZodTypeAny[],
): z.ZodTypeAny {
  const composed = inlineAllOf(members)
  return register(id, composed.openapi(id))
}
