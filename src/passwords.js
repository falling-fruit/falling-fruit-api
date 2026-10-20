const bcrypt = require('bcrypt')
const crypto = require('crypto')

const passwords = {}

// /**
//  * Hash text using SHA256.
//  *
//  * Always produces a string that is 256 bits (32 bytes) long.
//  * In base64, that is ceil(32/3) * 4 = 44 bytes, under the bcrypt 72 byte limit.
//  *
//  * @param {*} text
//  * @returns
//  */
// function sha256(text) {
//   return crypto.createHash("sha256").update(text).digest("base64")
// }

/**
 * Compare password to password hash.
 *
 * bcrypt truncates the input to 72 bytes, so the first 72 bytes of a password
 * would pass. To prevent this, we could prehash the password with sha256.
 * See https://security.stackexchange.com/q/6623.
 *
 * @param {*} password
 * @param {*} hash
 * @returns
 */
passwords.compare_password = function(password, hash) {
  return bcrypt.compare(password, hash)
}

passwords.hash_password = function(password) {
  return bcrypt.hash(password, 10)
}

module.exports = passwords
