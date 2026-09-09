import { Dialect, DIALECT_NAMES } from './Dialect.js';
import {
    DialectMySQL,
    DialectPostgres,
    DialectMSSQL,
    DialectMariaDB,
    DialectSQLite,
} from './index.js';

/**
 * Create the Dialect instance matching the given dialect name.
 * @param {string} name
 * @returns {Dialect}
 * @throws {Error} When the name is not one of the accepted dialects
 */
export const createDialect = (name: string): Dialect => {
    switch (name) {
        case 'postgres':
            return new DialectPostgres();
        case 'mysql':
            return new DialectMySQL();
        case 'mariadb':
            return new DialectMariaDB();
        case 'sqlite':
            return new DialectSQLite();
        case 'mssql':
            return new DialectMSSQL();
        default:
            throw new Error(
                `Unknown dialect '${name}': must be one of (${DIALECT_NAMES.join(', ')})`
            );
    }
};
