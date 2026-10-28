import makeRouter from './makeRouter'
import type { Services } from './services'

export = function ({ db, auth }: Services) {
  const { router, get } = makeRouter()

  get('/tiles/:z/:x/:y.pbf', auth.none, async (req, res) => {
    const mvt = await db.tiles.show(req.params)
    return void res.status(200).end(mvt)
  })

  return router
}
