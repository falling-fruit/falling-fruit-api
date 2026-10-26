const path = require('path')
const postmark = require('postmark')
const aws = require('aws-sdk')
const makeDb = require('./db')
const Tokenizer = require('./tokens')
const createMailer = require('./mailer')
const createPhotos = require('./photos')
const makeMiddleware = require('./middleware')
const makeRoutes = require('./routes')

function createLoggingPostmarkClient() {
  return {
    sendEmail({To, Subject, Tag, HtmlBody}) {
      console.log(
        `[email disabled] To: ${To} | Subject: ${Subject} | Tag: ${Tag}\n` +
        HtmlBody
      )
      return Promise.resolve()
    }
  }
}

function createLoggingS3({apiOrigin}) {
  return {
    upload({Key}) {
      return {
        promise() {
          const base = (apiOrigin || '').replace(/\/+$/, '')
          const location = `${base}/uploads/${Key.split(path.sep).join('/')}`
          console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
          return Promise.resolve({Location: location})
        }
      }
    },
    copyObject({CopySource, Key}) {
      return {
        promise() {
          console.log(`[s3 disabled] copyObject ${CopySource} -> ${Key}`)
          return Promise.resolve({})
        }
      }
    }
  }
}

function createDependencies(config) {
  const postmark_client = config.postmarkClient || (config.local
    ? createLoggingPostmarkClient()
    : new postmark.ServerClient(config.postmarkApiToken))

  const s3_client = config.s3Client || (config.local
    ? createLoggingS3({apiOrigin: config.apiOrigin})
    : new aws.S3({
        region: config.s3Region,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        apiVersion: '2006-03-01'
      }))

  const db = config.db || makeDb(config.dbUrl, true)
  const tokenizer = new Tokenizer(config.jwtSecret)
  const mailer = createMailer({ client: postmark_client })
  const photos = createPhotos({ s3: s3_client })
  const middleware = makeMiddleware({ db, tokenizer })
  const routes = makeRoutes({ db, tokenizer, middleware, mailer, photos })

  return { db, tokenizer, mailer, photos, middleware, routes }
}

module.exports = createDependencies
