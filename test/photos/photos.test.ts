import test from 'node:test'
import assert from 'node:assert/strict'

import createPhotos from '../../src/photos'

const { is_new_photo_url, sync_legacy_first_photo } = createPhotos

type PhotosDb = Parameters<typeof sync_legacy_first_photo>[0]
type Photos = Parameters<typeof sync_legacy_first_photo>[1]

test('is_new_photo_url returns true for new-style photos/ keys', () => {
  assert.equal(
    is_new_photo_url(
      'https://bucket.s3.us-east-1.amazonaws.com/photos/abc/original.jpg'
    ),
    true
  )
})

test('is_new_photo_url returns false for legacy observation keys', () => {
  assert.equal(
    is_new_photo_url(
      'https://bucket.s3.us-east-1.amazonaws.com/observations/photos/000/000/001/original/first.jpg'
    ),
    false
  )
})

test('is_new_photo_url returns false for non-S3 urls', () => {
  assert.equal(is_new_photo_url('https://example.com/photo.jpg'), false)
})

function makeDbStub(urls: Record<string, string>) {
  const calls = {
    get_urls: [] as number[],
    set_photo_file_name: [] as [number, string | null][],
  }
  const db: PhotosDb & { calls: typeof calls } = {
    calls,
    get_urls(id: number) {
      calls.get_urls.push(id)
      return Promise.resolve(urls)
    },
    set_photo_file_name(review_id: number, name: string | null) {
      calls.set_photo_file_name.push([review_id, name])
      return Promise.resolve(null)
    },
  }
  return db
}

function makePhotosStub() {
  const calls = {
    copy_photo_to_old_urls: [] as [Record<string, string>, number][],
  }
  const photos: Photos & { calls: typeof calls } = {
    calls,
    copy_photo_to_old_urls(urls: Record<string, string>, observation_id: number) {
      calls.copy_photo_to_old_urls.push([urls, observation_id])
      return Promise.resolve([])
    },
    resize_and_upload_photo(_input: string) {
      return Promise.resolve({})
    },
  }
  return photos
}

test('sync_legacy_first_photo copies and sets first.jpg for a new-style first photo', async () => {
  const urls = {
    thumb: 'https://bucket.s3.us-east-1.amazonaws.com/photos/a/thumb.jpg',
    medium: 'https://bucket.s3.us-east-1.amazonaws.com/photos/a/medium.jpg',
    original: 'https://bucket.s3.us-east-1.amazonaws.com/photos/a/original.jpg',
  }
  const db = makeDbStub(urls)
  const photos = makePhotosStub()

  await sync_legacy_first_photo(db, photos, [42, 7], 99)

  assert.deepEqual(db.calls.get_urls, [42])
  assert.deepEqual(photos.calls.copy_photo_to_old_urls, [[urls, 99]])
  assert.deepEqual(db.calls.set_photo_file_name, [[99, 'first.jpg']])
})

test('sync_legacy_first_photo does nothing to S3 for a legacy first photo', async () => {
  const urls = {
    thumb: 'https://bucket.s3.us-east-1.amazonaws.com/observations/thumb.jpg',
    medium: 'https://bucket.s3.us-east-1.amazonaws.com/observations/medium.jpg',
    original:
      'https://bucket.s3.us-east-1.amazonaws.com/observations/original.jpg',
  }
  const db = makeDbStub(urls)
  const photos = makePhotosStub()

  await sync_legacy_first_photo(db, photos, [42], 99)

  assert.deepEqual(db.calls.get_urls, [42])
  assert.deepEqual(photos.calls.copy_photo_to_old_urls, [])
  assert.deepEqual(db.calls.set_photo_file_name, [])
})

test('sync_legacy_first_photo clears photo_file_name when no photos', async () => {
  const db = makeDbStub({})
  const photos = makePhotosStub()

  await sync_legacy_first_photo(db, photos, [], 99)

  assert.deepEqual(db.calls.get_urls, [])
  assert.deepEqual(photos.calls.copy_photo_to_old_urls, [])
  assert.deepEqual(db.calls.set_photo_file_name, [[99, null]])
})
