import { IConfig, ModelBuilder, createDialect } from 'sequelize-typescript-generator';

(async () => {
    const config: IConfig = {
        connection: {
            dialect: 'mysql',
            database: 'myDatabase',
            username: 'myUsername',
            password: 'myPassword'
        },
        metadata: {
            indices: true,
            case: 'CAMEL',
        },
        output: {
            clean: true,
            outDir: 'models'
        },
        format: 'native',
    };

    const dialect = createDialect('mysql');

    const builder = new ModelBuilder(config, dialect);

    try {
        await builder.build();
    }
    catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
