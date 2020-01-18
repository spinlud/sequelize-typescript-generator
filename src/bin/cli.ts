#!/usr/bin/env node

import path from 'path';
import yargs from 'yargs';
import { Dialect as DialectType } from 'sequelize';
import { aliasesMap, validateArgs, error } from './validate';
import { IConfig } from '../config';
import { Dialect } from '../dialects/Dialect';
import { DialectMySQL } from '../dialects';
import { ModelBuilder } from '../builders';

(async () => {
    const defaultOutDir = 'output-models';

    const { argv } = yargs
        .usage(`Usage: sta -h <host> -d <database> -D <dialect> -u <username> -x [password] -o [out-dir] -s [schema] -t [tables] -T [skip-tables] -c [camel] -n [underscore]`)
        .demand(['host', 'database', 'username', 'dialect'])
        .option('h', {
            alias: aliasesMap.HOST,
            string: true,
            describe: `Database IP/hostname.`,
        })
        .option('p', {
            alias: aliasesMap.PORT,
            number: true,
            describe: `Database port. Defaults: \n - MySQL/MariaDB: 3306 \n - Postgres: 5432 \n - MSSQL: 1433`,
        })
        .option('d', {
            alias: aliasesMap.DATABASE,
            string: true,
            describe: `Database name.`,
        })
        .option('s', {
            alias: aliasesMap.SCHEMA,
            string: true,
            describe: `Schema name (Postgre only?).`,
        })
        .option('D', {
            alias: aliasesMap.DIALECT,
            string: true,
            describe: `Dialect: \n - postgres \n - mysql \n - mariadb \n - sqlite \n - mssql`,
        })
        .option('u', {
            alias: aliasesMap.USERNAME,
            string: true,
            describe: `Database username.`,
        })
        .option('x', {
            alias: aliasesMap.PASSWORD,
            string: true,
            describe: `Database password.`,
        })
        .option('t', {
            alias: aliasesMap.TABLES,
            string: true,
            describe: `Comma-separated names of tables to process.`,
        })
        .option('T', {
            alias: aliasesMap.SKIP_TABLES,
            string: true,
            describe: `Comma-separated names of tables to skip.`,
        })
        .option('o', {
            alias: aliasesMap.OUTPUT_DIR,
            string: true,
            describe: `Output directory. Default: \n - ${defaultOutDir}`,
        })
        .option('l', {
            alias: aliasesMap.OUTPUT_DIR_CLEAN,
            boolean: true,
            describe: `Output directory. Default: \n - ${defaultOutDir}`,
        })
        .option('m', {
            alias: aliasesMap.TIMESTAMPS,
            boolean: true,
            describe: `Add default timestamps to tables`,
        })
        .option('c', {
            alias: aliasesMap.CAMELCASE,
            boolean: true,
            describe: `Use camel case to name files, models and fields.`,
        })
        .option('n', {
            alias: aliasesMap.UNDERSCORE,
            boolean: true,
            describe: `Use underscore case to name files, models and fields.`,
        });

// Args validation
    validateArgs(argv);

// Create dialect
    let dialect: Dialect;

    switch(argv[aliasesMap.DIALECT]) {
        case 'postgres':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'mysql':
            dialect = new DialectMySQL();
            break;
        case 'mariadb':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'sqlite':
            dialect = new DialectMySQL(); // TODO
            break;
        case 'mssql':
            dialect = new DialectMySQL(); // TODO
            break;
        default:
            error(`Unknown dialect ${argv[aliasesMap.DIALECT]}`);
    }

// Config
    const config: IConfig = {
        connection: {
            dialect: argv[aliasesMap.DIALECT] as DialectType,
            host: argv[aliasesMap.HOST] as string,
            ...argv[aliasesMap.PORT] && { port: argv[aliasesMap.PORT] as number },
            database: argv[aliasesMap.DATABASE] as string,
            username: argv[aliasesMap.USERNAME] as string,
            ...argv[aliasesMap.PASSWORD] && { password: argv[aliasesMap.PASSWORD] as string },
        },
        metadata: {
            ...argv[aliasesMap.TABLES] && { tables: (argv[aliasesMap.TABLES] as string).split(',') },
            ...argv[aliasesMap.SKIP_TABLES] && { skipTables: (argv[aliasesMap.SKIP_TABLES] as string).split(',') },
            camelCased: !!argv[aliasesMap.CAMELCASE],
            underscored: !!argv[aliasesMap.UNDERSCORE],
            timestamps: !!argv[aliasesMap.TIMESTAMPS],
        },
        output: {
            outDir: argv[aliasesMap.OUTPUT_DIR] ?
                path.isAbsolute(argv[aliasesMap.OUTPUT_DIR] as string) ?
                    argv[aliasesMap.OUTPUT_DIR] as string : path.join(process.cwd(), argv[aliasesMap.OUTPUT_DIR] as string)
                : path.join(process.cwd(), defaultOutDir),
            clean: !!argv[aliasesMap.OUTPUT_DIR_CLEAN],
        }
    };

    console.log(argv);
    console.log(config);

    const builder = new ModelBuilder(config, dialect!);
    await builder.build();
    console.log(`All done!`);
})();
