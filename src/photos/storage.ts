import fs from 'fs'
import path from 'path'
import aws from 'aws-sdk'
import type { Config } from '../config'

export interface PhotoStorage {
  upload(sourcePath: string, key: string): Promise<string>
  copy(sourceKey: string, destinationKey: string): Promise<void>
}

class FolderStorage implements PhotoStorage {
  private readonly baseUrl: string
  private readonly uploadsDir: string

  constructor({ baseUrl, uploadsDir }: { baseUrl: string; uploadsDir: string }) {
    this.baseUrl = baseUrl
    this.uploadsDir = uploadsDir
  }

  private keyToLocalPath(key: string): string {
    return path.join(this.uploadsDir, ...key.split('/'))
  }

  private keyToUrl(key: string): string {
    const relative = key.startsWith('photos/')
      ? key.slice('photos/'.length)
      : key
    return `${this.baseUrl}/${relative}`
  }

  async upload(sourcePath: string, key: string): Promise<string> {
    const destination = this.keyToLocalPath(key)
    const url = this.keyToUrl(key)
    console.log(`[folder storage] upload ${key} -> ${url}`)
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    await fs.promises.copyFile(sourcePath, destination)
    return url
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    console.log(`[folder storage] copy ${sourceKey} -> ${destinationKey}`)
    const source = this.keyToLocalPath(sourceKey)
    const destination = this.keyToLocalPath(destinationKey)
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    await fs.promises.copyFile(source, destination)
  }
}

class S3Storage implements PhotoStorage {
  private readonly s3: aws.S3
  private readonly bucket: string

  constructor(config: NonNullable<Config['s3']>) {
    this.bucket = config.bucket
    this.s3 = new aws.S3({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      apiVersion: '2006-03-01',
    })
  }

  async upload(sourcePath: string, key: string): Promise<string> {
    const { Location } = await this.s3
      .upload({
        ACL: 'public-read',
        Bucket: this.bucket,
        Body: fs.createReadStream(sourcePath),
        Key: key,
        ContentType: 'image/jpeg',
      })
      .promise()
    return Location
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await this.s3
      .copyObject({
        CopySource: `${this.bucket}/${sourceKey}`,
        Bucket: this.bucket,
        Key: destinationKey,
        ACL: 'public-read',
      })
      .promise()
  }
}

export function createPhotoStorage(config: Config): PhotoStorage {
  if (!config.s3) {
    const baseUrl = `http://localhost:${config.port ?? '3300'}${config.apiBase}/photos`
    return new FolderStorage({ baseUrl, uploadsDir: 'uploads' })
  }
  return new S3Storage(config.s3)
}
