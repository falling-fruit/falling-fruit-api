module.exports = {
  name: 'api',
  script: './src/index.ts',
  interpreter: 'node',
  interpreter_args: '--import tsx',
  node_args: '--max-http-header-size=32768',
  instances: 4,
  exec_mode: 'cluster',
  merge_logs: true
}
