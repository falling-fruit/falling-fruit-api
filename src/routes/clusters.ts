import makeRouter from './makeRouter'
import { z } from '../schemas/registry'
import { Cluster } from '../schemas/schemas'
import {
  boundsParam,
  zoomParam,
  muniParam,
  typesParam,
} from '../schemas/parameters'

export = function ({ db }: any) {
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
    (req: any) => db.clusters.list(req.query),
  )

  return router
}
