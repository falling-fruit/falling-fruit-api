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
import type { EmailClient } from './mailer'
import type { S3Client } from './photos'

function createLoggingPostmarkClient(): EmailClient {
  return {
    sendEmail({ To, Subject, Tag, HtmlBody }) {
      console.log(
        `[email disabled] To: ${To} | Subject: ${Subject} | Tag: ${Tag}\n` +
          HtmlBody,
      )
      return Promise.resolve()
    },
  }
}

function createLoggingS3({ apiOrigin }: { apiOrigin?: string }): S3Client {
  return {
    upload({ Key }) {
      return {
        promise() {
          const base = (apiOrigin || '').replace(/\/+$/, '')
          const location = `${base}/uploads/${Key.split(path.sep).join('/')}`
          console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
          return Promise.resolve({ Location: location })
        },
      }
    },
    copyObject({ CopySource, Key }) {
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

  let postmarkClient: EmailClient
  let s3Client: S3Client
  let recaptcha
  if (config.local) {
    postmarkClient = createLoggingPostmarkClient()
    s3Client = createLoggingS3({ apiOrigin: config.apiOrigin })
    recaptcha = null
  } else {
    // The SDK clients are stricter about null vs undefined than the app's
    // minimal contracts, so they are adapted to the contracts at this boundary.
    postmarkClient = new postmark.ServerClient(
      config.postmarkApiToken,
    ) as EmailClient
    s3Client = new aws.S3({
      region: config.s3Region,
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
      apiVersion: '2006-03-01',
    }) as unknown as S3Client
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
    postmarkClient: EmailClient
    s3Client: S3Client
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
