import { createDialect } from '../../dialects/createDialect.js';
import { DIALECT_NAMES } from '../../dialects/Dialect.js';
import { DialectMySQL } from '../../dialects/DialectMySQL.js';
import { DialectPostgres } from '../../dialects/DialectPostgres.js';
import { DialectMSSQL } from '../../dialects/DialectMSSQL.js';
import { DialectMariaDB } from '../../dialects/DialectMariaDB.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';

describe('createDialect', () => {
    it('returns an instance of the class matching each accepted name', () => {
        expect(createDialect('postgres')).toBeInstanceOf(DialectPostgres);
        expect(createDialect('mysql')).toBeInstanceOf(DialectMySQL);
        expect(createDialect('mariadb')).toBeInstanceOf(DialectMariaDB);
        expect(createDialect('sqlite')).toBeInstanceOf(DialectSQLite);
        expect(createDialect('mssql')).toBeInstanceOf(DialectMSSQL);
    });

    it('throws for an unknown name with a message listing all accepted names', () => {
        expect(() => createDialect('oracle')).toThrow(/oracle/);

        for (const name of DIALECT_NAMES) {
            expect(() => createDialect('oracle')).toThrow(new RegExp(name));
        }
    });
});
