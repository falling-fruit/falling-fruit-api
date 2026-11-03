import { registry } from './registry'

export const keyScheme = registry.registerComponent(
  'securitySchemes',
  'key',
  {
    type: 'apiKey',
    name: 'x-api-key',
    in: 'header',
    description: 'May also be passed as the query parameter `api_key`.',
  },
)

export const tokenScheme = registry.registerComponent(
  'securitySchemes',
  'token',
  {
    type: 'oauth2',
    flows: {
      password: {
        tokenUrl: 'user/token',
        refreshUrl: 'user/token/refresh',
        scopes: {},
      },
    },
  },
)
