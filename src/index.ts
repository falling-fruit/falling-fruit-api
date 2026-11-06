import { Config } from './config'
import createDependencies from './dependencies'
import createApp from './app'

const config = Config()
const { middleware, routes } = createDependencies(config)
const app = createApp({
  middleware,
  routes,
  apiBase: config.apiBase,
  serveFolderPhotos: config.s3 == null,
})

// Start server
app.listen(config.port, () => {
  console.log(`Ready for requests on http://localhost:${config.port}`)
})
