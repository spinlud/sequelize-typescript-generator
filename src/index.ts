import path from 'path';
import { IConfig } from './config';
import { DialectMySQL } from './dialects';
import { ModelBuilder } from './builders';

(async () => {

    const config: IConfig = {
        connection: {
            dialect: 'mysql',
            host: 'localhost',
            port: 3306,
            database: 'administration',
            username: 'root',
            password: 'mysql',
        },
        output: {
            outDir: path.join(__dirname, 'output'),
            clean: true,
        }
    }

    const dialect = new DialectMySQL();
    const builder = new ModelBuilder(config, dialect);

    await builder.build();
})();
