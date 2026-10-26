require('dotenv').config()
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')
const sharp = require('sharp')

function createPhotos({s3}) {
  const photos = {}

  async function resize_photo(input, output, size = null) {
    const image = sharp(input)
    const metadata = await image.metadata()
    if (metadata.format === 'jpeg' && metadata.width <= size && metadata.height <= size) {
      return input
    }
    await image
      // https://sharp.pixelplumbing.com/api-resize#resize
      .resize({width: size, height: size, fit: 'inside', withoutEnlargement: true})
      .rotate()
      .withMetadata()
      // Convert to JPEG
      .jpeg()
      .toFile(output)
    return output
  }

  async function upload_photo(input, output) {
    return s3.upload({
      ACL: 'public-read',
      Bucket: process.env.S3_BUCKET,
      Body: fs.createReadStream(input),
      Key: output,
      ContentType: 'image/jpeg'
    }).promise()
  }

  // ---- For backwards compatibility only ----

  function id_partition(id) {
    const pad = String(id).padStart(9, '0')
    return path.join(pad.substr(0, 3), pad.substr(3, 3), pad.substr(6, 3))
  }

  function build_s3_photo_keys(observation_id, filename = 'first.jpg') {
    const base = path.join('observations', 'photos', id_partition(observation_id))
    return {
      thumb: path.join(base, 'thumb', filename),
      medium: path.join(base, 'medium', filename),
      original: path.join(base, 'original', filename)
    }
  }

  function parse_s3_url(url) {
    const regex = /^https?:\/\/(?<bucket>[^\.]+)\.s3\.(?<region>[^\.]+)\.amazonaws\.com\/(?<key>.*)$/
    const match = regex.exec(url)
    if (match == null) {
      throw Error(`S3 URL not formatted as expected: ${url}`)
    }
    return match.groups
  }

  photos.is_new_photo_url = function(url) {
    const match = /^https?:\/\/(?<bucket>[^\.]+)\.s3\.(?<region>[^\.]+)\.amazonaws\.com\/(?<key>.*)$/.exec(url)
    if (match == null) {
      return false
    }
    return match.groups.key.startsWith('photos/')
  }

  photos.copy_photo_to_old_urls = function(urls, observation_id) {
    const keys = build_s3_photo_keys(observation_id)
    const promises = ['thumb', 'medium', 'original'].map(style => {
      const parsed = parse_s3_url(urls[style])
      return s3.copyObject({
        CopySource: `${parsed.bucket}/${parsed.key}`,
        Bucket: process.env.S3_BUCKET,
        Key: keys[style],
        ACL: 'public-read'
      }).promise()
    })
    return Promise.all(promises)
  }

  photos.resize_and_upload_photo = async function(input) {
    sizes = {
      thumb: 100,
      medium: 300,
      original: 2048
    }
    const promises = []
    for (const style in sizes) {
      const job = async function() {
        const resized = `${input}-${style}.jpg`
        const to_upload = await resize_photo(input, resized, sizes[style])
        const output = path.join('photos', path.basename(input), `${style}.jpg`)
        const upload = await upload_photo(to_upload, output, 'image/jpeg')
        if (to_upload === resized) {
          await fs.promises.unlink(resized)
        }
        return upload.Location
      }
      promises.push(job())
    }
    const urls = await Promise.all(promises)
    await fs.promises.unlink(input)
    return Object.fromEntries(Object.keys(sizes).map((k, i) => [k, urls[i]]))
  }

  return photos
}

const logging_s3 = {
  upload({Key}) {
    return {
      promise() {
        const base = (process.env.API_ORIGIN || '').replace(/\/+$/, '')
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

const default_s3 = process.env.S3_DISABLED
  ? logging_s3
  : new aws.S3({
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      apiVersion: '2006-03-01'
    })

const photos = createPhotos({s3: default_s3})
photos.createPhotos = createPhotos

module.exports = photos
