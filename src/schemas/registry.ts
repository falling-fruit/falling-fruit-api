import { z } from 'zod'
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

export { z }

export function register<T extends z.ZodTypeAny>(id: string, schema: T): T {
  const described = schema.openapi(id)
  registry.register(id, described)
  return described
}

export function intEnum<const V extends readonly [number, ...number[]]>(
  values: V,
  opts: { nullable: true },
): z.ZodNullable<z.ZodUnion<{ [K in keyof V]: z.ZodLiteral<V[K]> }>>
export function intEnum<const V extends readonly [number, ...number[]]>(
  values: V,
  opts?: { nullable?: false },
): z.ZodUnion<{ [K in keyof V]: z.ZodLiteral<V[K]> }>
export function intEnum<const V extends readonly [number, ...number[]]>(
  values: V,
  { nullable = false }: { nullable?: boolean } = {},
) {
  const literals = values.map((v) => z.literal(v)) as unknown as {
    [K in keyof V]: z.ZodLiteral<V[K]>
  }
  const described = z.union(literals).openapi({
    type: 'integer',
    enum: values as unknown as number[],
    ...(nullable ? { nullable: true } : {}),
  })
  return nullable ? described.nullable() : described
}

type IntersectionOf<Members extends z.ZodTypeAny[]> = Members extends [
  infer First extends z.ZodTypeAny,
]
  ? First
  : Members extends [
        infer First extends z.ZodTypeAny,
        ...infer Rest extends z.ZodTypeAny[],
      ]
    ? z.ZodIntersection<First, IntersectionOf<Rest>>
    : z.ZodTypeAny

export function inlineAllOf<Members extends [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
  members: Members,
): IntersectionOf<Members> {
  const [first, ...rest] = members
  return rest.reduce<z.ZodTypeAny>(
    (acc, member) => z.intersection(acc, member),
    first,
  ) as IntersectionOf<Members>
}

export function allOf<Members extends [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
  id: string,
  members: Members,
): IntersectionOf<Members> {
  const composed = inlineAllOf(members)
  const described = composed.openapi(id) as IntersectionOf<Members>
  registry.register(id, described)
  return described
}
