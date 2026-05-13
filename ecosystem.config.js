module.exports = {
  name: 'api',
  script: './index.js',
  node_args: '--max-http-header-size=32768',
  instances: 4,
  exec_mode: 'cluster',
  merge_logs: true
}
