import { createSequelize } from './connection';
import { DialectMySQL } from './dialects';
import { ModelGenerator } from './generators';

(async () => {

    const connection = createSequelize({
        dialect: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'administration',
        username: 'root',
        password: 'mysql',
    });

    const dialectMySQL = new DialectMySQL(connection, { schemaName: 'administration' });
    const modelGenerator = new ModelGenerator(dialectMySQL);


    const tableMetadata = tablesMetadata.find(t => t.name === 'tutti');
    console.log(generateModel(tableMetadata!));

    connection.close();

})();
