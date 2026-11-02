import { RecaptchaV2 } from 'express-recaptcha'

import makeDb from './db'
import Tokenizer from './tokens'
import makeAuth from './auth'
import Mailer from './mail/mailer'
import { createEmailClient } from './mail/email_client'
import createPhotos from './photos'
import makeMiddleware from './middleware'
import makeRoutes from './routes'
import type { Config } from './config'
import type { Db } from './db/types'
import type { EmailClient } from './mail/email_client'
import type { S3Client } from './photos'

function createDependencies(config: Config) {
  const db = makeDb(config.dbUrl, true)
  const postmarkClient = createEmailClient(config)
  const s3Client = createPhotos.createS3Client(config)
  const recaptcha = makeMiddleware.createRecaptcha(config)

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
  const mailer = new Mailer({
    client: postmarkClient,
    webOrigin: config.webOrigin,
  })
  const photos = createPhotos({ s3: s3Client, bucket: config.s3?.bucket })
  const middleware = makeMiddleware({
    db,
    tokenizer,
    recaptcha,
    postmarkSecret: config.postmark?.secret,
  })
  const routes = makeRoutes({
    db,
    tokenizer,
    middleware,
    auth,
    mailer,
    photos,
    postmarkServerId: config.postmark?.serverId,
    postmarkBroadcastStream: config.postmark?.broadcastStream,
  })

  return { db, tokenizer, auth, mailer, photos, middleware, routes }
}

createDependencies.createDependenciesForClients = createDependenciesForClients

export default createDependencies
