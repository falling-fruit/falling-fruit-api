import bcrypt from 'bcrypt'

const passwords = {} as {
  compare_password: (password: string, hash: string) => Promise<boolean>
  hash_password: (password: string) => Promise<string>
}

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
 */
passwords.compare_password = function (
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

passwords.hash_password = function (password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export default passwords
