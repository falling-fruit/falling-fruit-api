import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import type { OpenAPIObject } from 'openapi3-ts/oas30'

import '../src/schemas'
import { registry } from '../src/schemas/registry'
import makeRoutes from '../src/routes'
import type { Services } from '../src/routes/services'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DOCS_DIR = path.resolve(__dirname, '..', 'docs')

/** Static metadata read from `docs/base.yml`. */
type BaseDocument = Pick<
  OpenAPIObject,
  'openapi' | 'info' | 'servers' | 'tags'
>

function loadYaml(file: string): BaseDocument {
  return yaml.load(fs.readFileSync(file, 'utf8')) as BaseDocument
}

// Register every route's OpenAPI path by instantiating the route factories
// with a proxy that stands in for the real services. Route handlers are never
// invoked here; we only trigger the registerPath() side effects.
function registerRoutePaths(): void {
  const noop = () => undefined
  const callable = () => noop
  const servicesProxy = new Proxy(
    {},
    {
      get() {
        return new Proxy(callable, {
          get() {
            return callable
          },
          apply() {
            // middleware.authenticate() -> [], middleware.recaptcha -> fn
            return []
          },
        })
      },
    },
  ) as unknown as Services
  makeRoutes(servicesProxy)
}

function buildDocument() {
  registerRoutePaths()

  const base = loadYaml(path.join(DOCS_DIR, 'base.yml'))
  const generator = new OpenApiGeneratorV3(registry.definitions)
  const generated = generator.generateDocument({
    openapi: base.openapi,
    info: base.info,
    servers: base.servers,
    tags: base.tags,
  })

  // registerParameter also registers the parameter's underlying schema under
  // components.schemas and references it from the parameter via $ref. The
  // original spec inlines parameter schemas, so inline them back and drop the
  // duplicated schema entries.
  const schemas = generated.components?.schemas ?? {}
  const parameters = generated.components?.parameters ?? {}
  const inlinedSchemaNames = new Set<string>()
  for (const param of Object.values(parameters)) {
    const schema = (param as { schema?: { $ref?: string } }).schema
    const ref = schema?.$ref
    if (typeof ref === 'string') {
      const name = ref.replace('#/components/schemas/', '')
      if (schemas[name]) {
        ;(param as { schema?: unknown }).schema = schemas[name]
        inlinedSchemaNames.add(name)
      }
    }
  }
  for (const name of inlinedSchemaNames) {
    delete schemas[name]
  }

  return generated
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const spec = buildDocument()
  // JSON round-trip drops undefined values so js-yaml does not emit
  // !!js/undefined tags.
  const clean = JSON.parse(JSON.stringify(spec)) as OpenAPIObject
  const out = yaml.dump(clean, { noRefs: true, lineWidth: -1 })
  const target = path.join(DOCS_DIR, 'openapi.yml')
  fs.writeFileSync(target, out)
  console.log(
    `Wrote ${target} (${Object.keys(spec.paths || {}).length} paths)`,
  )
}

export { buildDocument }
