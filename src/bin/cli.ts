#!/usr/bin/env node

import yargs from 'yargs';
import { ModelBuilder } from '../builders';
import {
    defaultOutputDir,
    aliasesMap,
    validateArgs,
    buildConfig,
    buildDialect,
} from './utils';

process.on('unhandledRejection', (reason, promise) => {
    console.error(reason, promise);
    process.exit(1);
});

export const cli = async (): Promise<void> => {
    let usage = `Usage: stg -D <dialect> -d [database] -u [username] -x [password] `;
    usage += `-h [host] -p [port] -o [out-dir] -s [schema] -a [associations-file]`;
    usage += `-t [tables] -T [skip-tables] -V [no-views] -i [indices] -C [case] -S [storage] -L [lint-file] `;
    usage += `-l [ssl] -r [protocol] -n [dialect-options] -c [clean] -g [logs]`;

    const {argv} = yargs
        .usage(usage)
        .demand(['dialect'])
        .option('h', {
            alias: aliasesMap.HOST,
            string: true,
            describe: `Database IP/hostname`,
        })
        .option('p', {
            alias: aliasesMap.PORT,
            number: true,
            describe: `Database port. Defaults: \n - MySQL/MariaDB: 3306 \n - Postgres: 5432 \n - MSSQL: 1433`,
        })
        .option('d', {
            alias: aliasesMap.DATABASE,
            string: true,
            describe: `Database name`,
        })
        .option('s', {
            alias: aliasesMap.SCHEMA,
            string: true,
            describe: `Schema name (Postgres only). Default: \n - public`,
        })
        .option('D', {
            alias: aliasesMap.DIALECT,
            string: true,
            describe: `Dialect: \n - postgres \n - mysql \n - mariadb \n - sqlite \n - mssql`,
        })
        .option('u', {
            alias: aliasesMap.USERNAME,
            string: true,
            describe: `Database username`,
        })
        .option('x', {
            alias: aliasesMap.PASSWORD,
            string: true,
            describe: `Database password`,
        })
        .option('t', {
            alias: aliasesMap.TABLES,
            string: true,
            describe: `Comma-separated names of tables to process`,
        })
        .option('T', {
            alias: aliasesMap.SKIP_TABLES,
            string: true,
            describe: `Comma-separated names of tables to skip`,
        })
        .option('i', {
            alias: aliasesMap.INDICES,
            boolean: true,
            describe: `Include index annotations in the generated models`,
        })
        .option('o', {
            alias: aliasesMap.OUTPUT_DIR,
            string: true,
            describe: `Output directory. Default: \n - ${defaultOutputDir}`,
        })
        .option('c', {
            alias: aliasesMap.OUTPUT_DIR_CLEAN,
            boolean: true,
            describe: `Clean output directory before running`,
        })
        .option('m', {
            alias: aliasesMap.TIMESTAMPS,
            boolean: true,
            describe: `Add default timestamps to tables`,
        })
        .option('C', {
            alias: aliasesMap.CASE,
            string: true,
            describe: `Transform tables and fields names with one of the following cases:
             - underscore
             - camel
             - upper
             - lower
             - pascal
             - const
             You can also specify a different case for model and columns using the following format:
               <model case>:<column case>    
            `,
        }).option('S', {
            alias: aliasesMap.STORAGE,
            string: true,
            describe: `SQLite storage. Default: \n - memory`,
        }).option('L', {
            alias: aliasesMap.LINT_FILE,
            string: true,
            describe: `ES Lint file path`,
        }).option('l', {
            alias: aliasesMap.SSL,
            boolean: true,
            describe: `Enable SSL`,
        }).option('r', {
            alias: aliasesMap.PROTOCOL,
            string: true,
            describe: `Protocol used: Default: \n - tcp`,
        }).option('a', {
            alias: aliasesMap.ASSOCIATIONS_FILE,
            string: true,
            describe: `Associations file path`,
        }).option('g', {
            alias: aliasesMap.ENABLE_SEQUELIZE_LOGS,
            boolean: true,
            describe: `Enable Sequelize logs`,
        }).option('n', {
            alias: aliasesMap.DIALECT_OPTIONS,
            type: 'string',
            describe: `Dialect native options passed as json string.`,
        }).option('f', {
            alias: aliasesMap.DIALECT_OPTIONS_FILE,
            type: 'string',
            describe: `Dialect native options passed as json file path.`,
        }).option('R', {
            alias: aliasesMap.DISABLE_STRICT,
            boolean: true,
            describe: `Disable strict typescript class declaration.`,
        }).option('V', {
            alias: aliasesMap.DISABLE_VIEWS,
            boolean: true,
            describe: `Disable views generation. Available for: MySQL and MariaDB.`,
        });

    validateArgs(argv);

    const config = buildConfig(argv);
    const dialect = buildDialect(argv);

    const builder = new ModelBuilder(config, dialect);
    await builder.build();
    console.log(`All done!`);
};

(async () => {
    await cli();
})();
