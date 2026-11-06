import fs from 'fs'
import path from 'path'
import aws from 'aws-sdk'
import type { Config } from '../config'

export type PhotoStorage = {
  upload(sourcePath: string, key: string): Promise<string>
  copy(sourceKey: string, destinationKey: string): Promise<void>
}

function createFolderStorage(baseUrl: string, uploadsDir: string): PhotoStorage {
  function keyToLocalPath(key: string): string {
    return path.join(uploadsDir, ...key.split('/'))
  }

  function keyToUrl(key: string): string {
    const relative = key.startsWith('photos/') ? key.slice('photos/'.length) : key
    return `${baseUrl}/${relative}`
  }

  return {
    async upload(sourcePath, key) {
      const destination = keyToLocalPath(key)
      const url = keyToUrl(key)
      console.log(`[folder storage] upload ${key} -> ${url}`)
      await fs.promises.mkdir(path.dirname(destination), { recursive: true })
      await fs.promises.copyFile(sourcePath, destination)
      return url
    },
    async copy(sourceKey, destinationKey) {
      console.log(`[folder storage] copy ${sourceKey} -> ${destinationKey}`)
      const source = keyToLocalPath(sourceKey)
      const destination = keyToLocalPath(destinationKey)
      await fs.promises.mkdir(path.dirname(destination), { recursive: true })
      await fs.promises.copyFile(source, destination)
    },
  }
}

function createS3Storage(config: NonNullable<Config['s3']>): PhotoStorage {
  const s3 = new aws.S3({
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    apiVersion: '2006-03-01',
  })

  return {
    async upload(sourcePath, key) {
      const { Location } = await s3
        .upload({
          ACL: 'public-read',
          Bucket: config.bucket,
          Body: fs.createReadStream(sourcePath),
          Key: key,
          ContentType: 'image/jpeg',
        })
        .promise()
      return Location
    },
    async copy(sourceKey, destinationKey) {
      await s3
        .copyObject({
          CopySource: `${config.bucket}/${sourceKey}`,
          Bucket: config.bucket,
          Key: destinationKey,
          ACL: 'public-read',
        })
        .promise()
    },
  }
}

export function createPhotoStorage(config: Config): PhotoStorage {
  if (!config.s3) {
    const baseUrl = `http://localhost:${config.port ?? '3300'}${config.apiBase}/photos`
    return createFolderStorage(baseUrl, 'uploads')
  }
  return createS3Storage(config.s3)
}
