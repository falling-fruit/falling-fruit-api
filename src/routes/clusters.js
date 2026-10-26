const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /clusters:
 *   get:
 *     summary: Fetch Clusters.
 *     tags:
 *       - Clusters
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/bounds'
 *       - $ref: '#/components/parameters/zoom'
 *       - $ref: '#/components/parameters/muni'
 *       - $ref: '#/components/parameters/types'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Cluster'
 */
get(
  '/clusters',
  req => db.clusters.list(req.query)
)

  return router
}
