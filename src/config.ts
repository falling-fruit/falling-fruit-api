require('dotenv').config()
import { z } from 'zod'

const productionConfig = z.object({
  local: z.literal(false),
  port: z.string().optional(),
  apiOrigin: z.string().optional(),
  dbUrl: z.string(),
  jwtSecret: z.string(),
  postmarkApiToken: z.string(),
  postmarkSecret: z.string(),
  postmarkServerId: z.number(),
  postmarkBroadcastStream: z.string(),
  s3Region: z.string(),
  s3AccessKeyId: z.string(),
  s3SecretAccessKey: z.string(),
  recaptchaSiteKey: z.string(),
  recaptchaSecretKey: z.string(),
})

const localConfig = z.object({
  local: z.literal(true),
  port: z.string().optional(),
  apiOrigin: z.string().optional(),
  dbUrl: z.string().optional(),
  jwtSecret: z.string().optional(),
})

export const configSchema = z.discriminatedUnion('local', [
  productionConfig,
  localConfig,
])

export type Config = z.infer<typeof configSchema>

const local = process.env.NODE_ENV === 'development'

export const config: Config = configSchema.parse({
  local,
  port: process.env.PORT,
  apiOrigin: process.env.API_ORIGIN,
  dbUrl: process.env.DB,
  jwtSecret: process.env.JWT_SECRET,
  postmarkApiToken: process.env.POSTMARK_API_TOKEN,
  postmarkSecret: process.env.POSTMARK_SECRET,
  postmarkServerId: parseInt(process.env.POSTMARK_SERVER_ID as string),
  postmarkBroadcastStream: process.env.POSTMARK_BROADCAST_STREAM,
  s3Region: process.env.S3_REGION,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  recaptchaSecretKey: process.env.RECAPTCHA_SECRET_KEY,
})
