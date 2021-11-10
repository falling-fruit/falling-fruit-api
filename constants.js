module.exports = {
  PORT: 3300,
  ORIGIN: 'https://fallingfruit.org',
  BASE: '/test-api/0.3',
  JWT_OPTIONS: {
    algorithm: 'HS256',
    audience: 'https://fallingfruit.org/api',
    subject: 'user'
  },
  JWT_EXPIRES_IN: 900
}
