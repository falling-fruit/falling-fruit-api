import path from 'path'
import postmark from 'postmark'
import aws from 'aws-sdk'
import { RecaptchaV2 } from 'express-recaptcha'

const makeDb = require('./db')
const Tokenizer = require('./tokens')
const createMailer = require('./mailer')
const createPhotos = require('./photos')
const makeMiddleware = require('./middleware')
import makeRoutes from './routes'
import type { Config } from './config'

function createLoggingPostmarkClient() {
  return {
    sendEmail({ To, Subject, Tag, HtmlBody }: any) {
      console.log(
        `[email disabled] To: ${To} | Subject: ${Subject} | Tag: ${Tag}\n` +
          HtmlBody,
      )
      return Promise.resolve()
    },
  }
}

function createLoggingS3({ apiOrigin }: any) {
  return {
    upload({ Key }: any) {
      return {
        promise() {
          const base = (apiOrigin || '').replace(/\/+$/, '')
          const location = `${base}/uploads/${Key.split(path.sep).join('/')}`
          console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
          return Promise.resolve({ Location: location })
        },
      }
    },
    copyObject({ CopySource, Key }: any) {
      return {
        promise() {
          console.log(`[s3 disabled] copyObject ${CopySource} -> ${Key}`)
          return Promise.resolve({})
        },
      }
    },
  }
}

function createDependencies(config: Config) {
  const db = makeDb(config.dbUrl, true)

  let postmarkClient
  let s3Client
  let recaptcha
  if (config.local) {
    postmarkClient = createLoggingPostmarkClient()
    s3Client = createLoggingS3({ apiOrigin: config.apiOrigin })
    recaptcha = null
  } else {
    postmarkClient = new postmark.ServerClient(config.postmarkApiToken)
    s3Client = new aws.S3({
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      apiVersion: '2006-03-01',
    })
    recaptcha = new RecaptchaV2(
      config.recaptchaSiteKey,
      config.recaptchaSecretKey,
    )
  }

  return createDependenciesForClients(config, {
    db,
    postmarkClient,
    s3Client,
    recaptcha,
  })
}

function createDependenciesForClients(
  config: Config,
  {
    db,
    postmarkClient,
    s3Client,
    recaptcha,
  }: { db: any; postmarkClient: any; s3Client: any; recaptcha: any },
) {
  const tokenizer = new Tokenizer(config.jwtSecret)
  const mailer = createMailer({ client: postmarkClient })
  const photos = createPhotos({ s3: s3Client })
  const middleware = makeMiddleware({
    db,
    tokenizer,
    recaptcha,
    postmarkSecret: config.local ? undefined : config.postmarkSecret,
  })
  const routes = makeRoutes({
    db,
    tokenizer,
    middleware,
    mailer,
    photos,
    postmarkServerId: config.local ? undefined : config.postmarkServerId,
    postmarkBroadcastStream: config.local
      ? undefined
      : config.postmarkBroadcastStream,
  })

  return { db, tokenizer, mailer, photos, middleware, routes }
}

createDependencies.createDependenciesForClients = createDependenciesForClients

export = createDependencies
