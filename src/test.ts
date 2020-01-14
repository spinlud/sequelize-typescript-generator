import { createSequelize } from './connection';
import { DialectMySQL } from './dialects/DialectMySQL';

(async () => {

    const connection = createSequelize({
        dialect: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'administration',
        username: 'root',
        password: 'mysql',
    });

    const dialectMySQL = new DialectMySQL(connection);

    const res = await dialectMySQL.getMetadata({
        schemaName: 'administration',
    });

    connection.close();

})();
