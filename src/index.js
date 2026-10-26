require('dotenv').config()
const createDependencies = require('./dependencies')
const createApp = require('./app')

const local = process.env.NODE_ENV === 'development'

const PRODUCTION_VARS = [
  'POSTMARK_API_TOKEN',
  'S3_REGION',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
]

const setVars = PRODUCTION_VARS.filter((name) => !!process.env[name])
const missingVars = PRODUCTION_VARS.filter((name) => !process.env[name])

if (local && setVars.length) {
  throw new Error(
    "NODE_ENV is 'development' but production variables are set: " +
    `${setVars.join(', ')}; unset them for local development`
  )
}
if (!local && missingVars.length) {
  throw new Error(
    `NODE_ENV is '${process.env.NODE_ENV}' but production variables are missing: ` +
    `${missingVars.join(', ')}`
  )
}

const config = {
  local,
  dbUrl: process.env.DB,
  jwtSecret: process.env.JWT_SECRET,
  apiOrigin: process.env.API_ORIGIN,
  postmarkApiToken: process.env.POSTMARK_API_TOKEN,
  s3Region: process.env.S3_REGION,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
}

const { middleware, routes } = createDependencies(config)
const app = createApp({ middleware, routes, apiBase: process.env.API_BASE })

// Start server
app.listen(process.env.PORT, () => {
    console.log(`Ready for requests on http://localhost:${process.env.PORT}`)
})
