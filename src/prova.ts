import { createSequelize } from './connection';
import { DialectMySQL } from './dialects/DialectMySQL';
import { generateNamedImports, generateModel } from './generators';

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

    const tablesMetadata = await dialectMySQL.getMetadata({
        schemaName: 'administration',
    });

    const tableMetadata = tablesMetadata.find(t => t.name === 'tutti');
    console.log(generateModel(tableMetadata!));

    connection.close();

})();
