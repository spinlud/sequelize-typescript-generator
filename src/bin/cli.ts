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

export const cli = async (): Promise<void> => {
    const {argv} = yargs
        .usage(`Usage: sta -d <database> -D <dialect> -u <username> -x [password] -h [host] -p [port] -o [out-dir] -s [schema] -t [tables] -T [skip-tables] -i [indices] -c [camel] -n [underscore]`)
        .demand(['database', 'username', 'dialect'])
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
        .option('i', {
            alias: aliasesMap.INDICES,
            boolean: true,
            describe: `Include columns index in the generated models`,
        })
        .option('o', {
            alias: aliasesMap.OUTPUT_DIR,
            string: true,
            describe: `Output directory. Default: \n - ${defaultOutputDir}`,
        })
        .option('l', {
            alias: aliasesMap.OUTPUT_DIR_CLEAN,
            boolean: true,
            describe: `Output directory. Default: \n - ${defaultOutputDir}`,
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

    const config = buildConfig(argv);
    const dialect = buildDialect(argv);

    console.log(argv);
    console.log(config);

    const builder = new ModelBuilder(config, dialect);
    await builder.build();
    console.log(`All done!`);
}

(async () => {
    await cli();
})();
