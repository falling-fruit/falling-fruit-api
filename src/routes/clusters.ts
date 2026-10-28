import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import { Cluster } from '../schemas/schemas'
import {
  boundsParam,
  zoomParam,
  muniParam,
  typesParam,
} from '../schemas/parameters'

export = function ({ db, auth }: Services) {
  const { router, get } = makeRouter()

  get(
    {
      path: '/clusters',
      summary: 'Fetch Clusters.',
      tags: ['Clusters'],
      security: [{ key: [] }],
      request: {
        query: z.object({
          bounds: boundsParam,
          zoom: zoomParam,
          muni: muniParam,
          types: typesParam,
        }),
      },
      responses: {
        '200': { description: 'Success', schema: z.array(Cluster) },
      },
    },
    auth.none,
    (req) => db.clusters.list(req.query),
  )

  return router
}
