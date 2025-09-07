// Minimal runtime stub for @platform/db/src/datasource

// a placeholder in-memory "datasource" object
const dataSource = {};

// keep both names because your code imported both in different places
const AppDataSource = dataSource;

// async getter to match expected API shape
async function getDataSource() {
  return dataSource;
}

module.exports = {
  dataSource,
  AppDataSource,
  getDataSource,
};