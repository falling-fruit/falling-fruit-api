const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const swaggerJsdoc = require('swagger-jsdoc')

const DOCS_DIR = path.resolve(__dirname, '..', 'docs')
const COMPONENTS_DIR = path.join(DOCS_DIR, 'components')
const ROUTES_GLOB = path.resolve(__dirname, '..', 'src', 'routes', '*.js')

function loadYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'))
}

function rewriteRefs(node) {
  if (Array.isArray(node)) {
    return node.map(rewriteRefs)
  }
  if (node && typeof node === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        out[key] = internalizeRef(value)
      } else {
        out[key] = rewriteRefs(value)
      }
    }
    return out
  }
  return node
}

function internalizeRef(ref) {
  const fileMatch = ref.match(/([A-Za-z]+)\.yml#\/(.+)$/)
  if (fileMatch) {
    const [, fileBase, pointer] = fileMatch
    const section = fileBase === 'parameters'
      ? 'parameters'
      : fileBase === 'securitySchemes'
        ? 'securitySchemes'
        : 'schemas'
    return `#/components/${section}/${pointer}`
  }
  // Bare same-document refs in schema/geojson/properties files point to
  // sibling schemas, which all merge under components/schemas.
  const bareMatch = ref.match(/^#\/([A-Za-z].*)$/)
  if (bareMatch && !ref.startsWith('#/components/')) {
    return `#/components/schemas/${bareMatch[1]}`
  }
  return ref
}

function buildComponents() {
  const schemas = {
    ...loadYaml(path.join(COMPONENTS_DIR, 'geojson.yml')),
    ...loadYaml(path.join(COMPONENTS_DIR, 'properties.yml')),
    ...loadYaml(path.join(COMPONENTS_DIR, 'schemas.yml')),
  }
  const parameters = loadYaml(path.join(COMPONENTS_DIR, 'parameters.yml'))
  const securitySchemes = loadYaml(path.join(COMPONENTS_DIR, 'securitySchemes.yml'))
  return rewriteRefs({ schemas, parameters, securitySchemes })
}

function buildSpec() {
  const base = loadYaml(path.join(DOCS_DIR, 'base.yml'))
  const definition = {
    ...base,
    components: buildComponents(),
  }
  return swaggerJsdoc({
    definition,
    apis: [ROUTES_GLOB],
  })
}

if (require.main === module) {
  const spec = buildSpec()
  const out = yaml.dump(spec, { noRefs: true, lineWidth: -1 })
  const target = path.join(DOCS_DIR, 'openapi.yml')
  fs.writeFileSync(target, out)
  console.log(`Wrote ${target} (${Object.keys(spec.paths || {}).length} paths)`)
}

module.exports = { buildSpec }
