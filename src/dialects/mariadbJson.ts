/**
 * MariaDB stores a `JSON` column as `longtext` with a `CHECK (json_valid(<col>))`
 * constraint. These helpers recover the JSON columns of a table from the check
 * clauses (information_schema.CHECK_CONSTRAINTS) or, as a fallback for MariaDB
 * versions without that view, from the `SHOW CREATE TABLE` statement.
 */

/**
 * Match a `json_valid(<column>)` call, capturing the column name with its
 * optional surrounding backticks stripped. Case-insensitive and global so every
 * occurrence in a statement can be scanned.
 */
const JSON_VALID_PATTERN = /json_valid\(\s*`?([^`()\s]+)`?\s*\)/gi;

/**
 * A row of information_schema.CHECK_CONSTRAINTS relevant to JSON detection.
 */
export interface ICheckConstraintRow {
    CHECK_CLAUSE: string;
}

/**
 * A row of `SHOW CREATE TABLE`, whose second column holds the create statement.
 */
export interface IShowCreateTableRow {
    'Create Table'?: string;
    'CREATE TABLE'?: string;
}

/**
 * Extract the column names guarded by a `json_valid(...)` check from a set of
 * check clauses.
 * @param {ICheckConstraintRow[]} rows
 * @returns {Set<string>}
 */
export const extractJsonColumnsFromCheckConstraints = (rows: ICheckConstraintRow[]): Set<string> => {
    const columns = new Set<string>();

    for (const row of rows) {
        for (const columnName of matchJsonValidColumns(row.CHECK_CLAUSE ?? '')) {
            columns.add(columnName);
        }
    }

    return columns;
};

/**
 * Extract the column names guarded by a `json_valid(...)` check from a
 * `SHOW CREATE TABLE` statement.
 * @param {string} createTableStatement
 * @returns {Set<string>}
 */
export const extractJsonColumnsFromCreateTable = (createTableStatement: string): Set<string> =>
    new Set(matchJsonValidColumns(createTableStatement));

/**
 * Read the create statement out of a `SHOW CREATE TABLE` result row.
 * @param {IShowCreateTableRow | undefined} row
 * @returns {string}
 */
export const getCreateTableStatement = (row: IShowCreateTableRow | undefined): string =>
    row?.['Create Table'] ?? row?.['CREATE TABLE'] ?? '';

/**
 * Collect every column name captured by a `json_valid(...)` call in a string.
 * @param {string} value
 * @returns {string[]}
 */
const matchJsonValidColumns = (value: string): string[] => {
    const columns: string[] = [];

    for (const match of value.matchAll(JSON_VALID_PATTERN)) {
        columns.push(match[1]);
    }

    return columns;
};
