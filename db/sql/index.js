const QueryFile = require('pg-promise').QueryFile;
const enumSql = require('pg-promise').utils.enumSql;
module.exports = enumSql(__dirname, {recursive: true}, file => {
  return new QueryFile(file, {
    minify: true
  });
});
