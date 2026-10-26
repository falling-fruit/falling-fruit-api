const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /imports:
 *   get:
 *     summary: Fetch Imports.
 *     tags:
 *       - Imports
 *     security:
 *       - key: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Import'
 */
get('/imports', () => db.imports.list())

/**
 * @openapi
 * /imports/{id}:
 *   get:
 *     summary: Fetch Import.
 *     tags:
 *       - Imports
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/import_id'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Import'
 */
get('/imports/:id', req => db.imports.show(req.params.id))

  return router
}
