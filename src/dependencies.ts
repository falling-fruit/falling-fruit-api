import path from 'path'
import postmark from 'postmark'
import aws from 'aws-sdk'
import { RecaptchaV2 } from 'express-recaptcha'

import makeDb from './db'
import Tokenizer from './tokens'
import makeAuth from './auth'
import createMailer from './mailer'
import createPhotos from './photos'
import makeMiddleware from './middleware'
import makeRoutes from './routes'
import type { Config } from './config'
import type { Db } from './db/types'

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
  }: {
    db: Db
    postmarkClient: any
    s3Client: any
    recaptcha: RecaptchaV2 | null
  },
) {
  const tokenizer = new Tokenizer(config.jwtSecret ?? '')
  const auth = makeAuth({ tokenizer })
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
    auth,
    mailer,
    photos,
    postmarkServerId: config.local ? undefined : config.postmarkServerId,
    postmarkBroadcastStream: config.local
      ? undefined
      : config.postmarkBroadcastStream,
  })

  return { db, tokenizer, auth, mailer, photos, middleware, routes }
}

createDependencies.createDependenciesForClients = createDependenciesForClients

export default createDependencies
