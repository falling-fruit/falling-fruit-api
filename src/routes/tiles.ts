import makeRouter from './makeRouter'

export = function ({ db }: any) {
  const { router, get } = makeRouter()

  get('/tiles/:z/:x/:y.pbf', async (req: any, res: any) => {
    const mvt = await db.tiles.show(req.params)
    return void res.status(200).end(mvt)
  })

  return router
}
