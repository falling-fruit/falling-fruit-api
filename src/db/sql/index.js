const {QueryFile} = require('pg-promise')
const {enumSql} = require('pg-promise').utils
module.exports = enumSql(__dirname, {recursive: true}, file => {
  return new QueryFile(file, {
    minify: true
  })
})
