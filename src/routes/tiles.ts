import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'

export default function ({ db, auth }: Services) {
  const { router, get } = makeRouter()

  get(
    {
      path: '/tiles/:z/:x/:y.pbf',
      request: {
        params: z.object({
          z: z.string(),
          x: z.string(),
          y: z.string(),
        }),
      },
      responses: {
        '200': { description: 'Success' },
      },
    },
    auth.none,
    async (req, res) => {
      const mvt = await db.tiles.show(req.params)
      return void res.status(200).end(mvt)
    },
  )

  return router
}
