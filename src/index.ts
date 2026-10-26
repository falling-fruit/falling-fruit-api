import { config } from './config'
import createDependencies from './dependencies'
import createApp from './app'

const { middleware, routes } = createDependencies(config)
const app = createApp({ middleware, routes, apiBase: process.env.API_BASE })

// Start server
app.listen(config.port, () => {
  console.log(`Ready for requests on http://localhost:${config.port}`)
})
