const db = require('../db')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

get('/', () => db.imports.list())
get('/:id', req => db.imports.show(req.params.id))

module.exports = router
