import fs from 'fs'
import path from 'path'
import aws from 'aws-sdk'
import type { Config } from '../config'

type Promisable<T> = { promise(): Promise<T> }

export type S3Client = {
  upload(params: {
    ACL: string
    Bucket: string
    Body: fs.ReadStream
    Key: string
    ContentType: string
  }): Promisable<{ Location: string }>
  copyObject(params: {
    CopySource: string
    Bucket: string
    Key: string
    ACL: string
  }): Promisable<unknown>
}

function createLoggingS3(): S3Client {
  return {
    upload({ Body, Key }) {
      return {
        promise() {
          const location = `stub-upload:/${Key.split(path.sep).join('/')}`
          console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
          return new Promise((resolve, reject) => {
            Body.on('error', reject)
            Body.on('end', () => resolve({ Location: location }))
            Body.resume()
          })
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

export function createS3Client(config: Config): S3Client {
  if (!config.s3) {
    return createLoggingS3()
  }
  return new aws.S3({
    region: config.s3.region,
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
    apiVersion: '2006-03-01',
  }) as unknown as S3Client
}
