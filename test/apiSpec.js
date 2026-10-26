const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
const yaml = require('js-yaml')
const OpenAPIResponseValidator = require('openapi-response-validator').default

const SPEC_PATH = path.resolve(__dirname, '..', 'docs', 'openapi.yml')

const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'))

const validatorCache = new Map()

function getOperation(method, routePath) {
  const pathItem = spec.paths[routePath]
  assert.ok(pathItem, `OpenAPI spec has no path "${routePath}"`)
  const operation = pathItem[method.toLowerCase()]
  assert.ok(operation, `OpenAPI spec has no "${method}" on "${routePath}"`)
  return operation
}

function toValidatorResponses(operation, routePath, method) {
  const responses = {}
  for (const [code, response] of Object.entries(operation.responses || {})) {
    const schema = response.content
      && response.content['application/json']
      && response.content['application/json'].schema
    responses[code] = { schema: schema || {} }
  }
  assert.ok(
    Object.keys(responses).length > 0,
    `OpenAPI spec defines no responses for "${method}" "${routePath}"`
  )
  return responses
}

function getValidator(method, routePath) {
  const key = `${method.toLowerCase()} ${routePath}`
  if (validatorCache.has(key)) {
    return validatorCache.get(key)
  }
  const operation = getOperation(method, routePath)
  const validator = new OpenAPIResponseValidator({
    responses: toValidatorResponses(operation, routePath, method),
    components: spec.components
  })
  validatorCache.set(key, validator)
  return validator
}

function assertSatisfiesApiSpec(result, { method, path: routePath }) {
  const validator = getValidator(method, routePath)
  const error = validator.validateResponse(String(result.status), result.body)
  assert.equal(
    error,
    undefined,
    `Response for ${method} ${routePath} (status ${result.status}) `
      + `does not satisfy the OpenAPI spec:\n${JSON.stringify(error, null, 2)}`
  )
}

module.exports = { assertSatisfiesApiSpec }
