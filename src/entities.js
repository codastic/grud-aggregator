import _ from 'lodash';
import {getCompleteTable, getTablesByNames} from './pimApi';

export function getEntitiesOfTable(tableName, options = {}) {
  const {disableFollow = [], pimUrl} = options;

  if (_.isNil(pimUrl)) {
    throw new Error('Missing option pimUrl');
  }

  if (!_.isString(pimUrl)) {
    throw new Error('Expecting pimUrl to be a string');
  }

  if (!_.isArray(disableFollow) || _.some(disableFollow, columns => !_.isArray(columns))) {
    throw new Error('Expecting an array of columns as disableFollow');
  }

  const promises = {};
  const tables = {};

  return getTablesByNames(pimUrl, tableName)
    .then(tablesFromPim => Promise.all(
      _.map(tablesFromPim, table => getTableAndLinkedTablesAsPromise(table.id, disableFollow))
    ))
    .then(() => mapRowsOfTables(tables));

  function getTableAndLinkedTablesAsPromise(tableId, disableFollow) {
    if (!promises[tableId]) {
      const promiseOfLinkedTables = getCompleteTable(pimUrl, tableId)
        .then(table => {
          tables[tableId] = table;
          return Promise.all(_.flatMap(table.columns, column => {
            if (!promises[column.toTable] && column.kind === 'link' && !isDisabled(column.name, disableFollow)) {
              const filteredDisableFollow = _.filter(disableFollow, columns => {
                return !_.isEmpty(columns) && _.head(columns) === column.name;
              });
              const nextDisableFollow = _.map(filteredDisableFollow, columns => _.tail(columns));
              return [getTableAndLinkedTablesAsPromise(column.toTable, nextDisableFollow)];
            } else {
              return [];
            }
          }));
        });

      promises[tableId] = promiseOfLinkedTables;

      return promiseOfLinkedTables;
    } else {
      return promises[tableId];
    }
  }

  function isDisabled(columnName, disableFollow) {
    const disabledFollowInTable = _.filter(disableFollow, columns => _.size(columns) === 1);
    return _.some(disabledFollowInTable, columns => _.head(columns) === columnName);
  }
}

function mapRowsOfTables(tables) {
  return _.mapValues(tables, table => {
    const mappedTable = table;
    mappedTable.rows = _.transform(table.rows, (acc, row) => {
      acc[row.id] = row;
    }, {});
    return mappedTable;
  });
}
