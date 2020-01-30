import path from 'path';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../../connection';
import { buildSequelizeOptions } from '../../environment';
import {IConfig, DialectPostgres, ModelBuilder } from '../../../index';
import { Case, Cases } from '../../../config/IConfig';
import {
    SCHEMA_DROP,
    SCHEMA_CREATE,
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_CREATE,
    INDICES_TABLE_NAME,
    INDICES_TABLE_CREATE,
} from "./queries";
import {getTransformer} from "../../../dialects/utils";

const numericTests: [string, number | string][] = [
    ['smallint', 32767],
    ['integer', 2147483647],
    ['bigint', '100000000000000000'],
    ['decimal', '99.999'],
    ['numeric', '66.78'],
    ['real', 66.66],
    ['double', 11.2345],
    ['money', '$100,000.00'],
];

/**
 * Initialize test database
 * @param {Sequelize} connection
 * @returns {Promise<void>}
 */
const initTestDb = async (connection: Sequelize): Promise<void> => {
    await connection.query(SCHEMA_DROP);
    await connection.query(SCHEMA_CREATE);

    await connection.query(DATA_TYPES_TABLE_CREATE);
    await connection.query(INDICES_TABLE_CREATE);
}

describe('Postgres', () => {
    jest.setTimeout(120000);
    const outDir = path.join(process.cwd(), 'output-models');
    let sequelizeOptions = buildSequelizeOptions('postgres');

    describe('Build', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);
        });

        afterAll(async () => {
            connection && await connection.close();
        });

        it('should build models', async () => {
            const config: IConfig = {
                connection: sequelizeOptions,
                metadata: {
                    schema: process.env.TEST_DB_SCHEMA || 'public',
                },
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            console.log(config);

            const dialect = new DialectPostgres();
            const builder = new ModelBuilder(config, dialect);
            await builder.build();
        });

        it('should register models',() => {
            connection!.addModels([ outDir ]);
            connection!.model(DATA_TYPES_TABLE_NAME);
            connection!.model(INDICES_TABLE_NAME);

            expect(connection!.isDefined(DATA_TYPES_TABLE_NAME)).toBe(true);
            expect(connection!.isDefined(INDICES_TABLE_NAME)).toBe(true);
        });
    });

    describe('Filter --tables', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);

            const config: IConfig = {
                connection: sequelizeOptions,
                metadata: {
                    schema: process.env.TEST_DB_SCHEMA || 'public',
                    tables: [ INDICES_TABLE_NAME.toLowerCase() ]
                },
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            const dialect = new DialectPostgres();
            const builder = new ModelBuilder(config, dialect);
            await builder.build();
        });

        afterAll(async () => {
            connection && await connection.close();
        });

        it('should register models',() => {
            connection!.addModels([ outDir ]);
        });

        it('should have registered only the provided tables', () => {
            connection!.model(INDICES_TABLE_NAME);
            expect(() => connection!.model(DATA_TYPES_TABLE_NAME)).toThrow();

            expect(connection!.isDefined(INDICES_TABLE_NAME)).toBe(true);
            expect(connection!.isDefined(DATA_TYPES_TABLE_NAME)).toBe(false);
        });
    });

    describe('Filter --skip-tables', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);

            const config: IConfig = {
                connection: sequelizeOptions,
                metadata: {
                    schema: process.env.TEST_DB_SCHEMA || 'public',
                    skipTables: [ INDICES_TABLE_NAME.toLowerCase() ]
                },
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            const dialect = new DialectPostgres();
            const builder = new ModelBuilder(config, dialect);
            await builder.build();
        });

        afterAll(async () => {
            connection && await connection.close();
        });

        it('should register models',() => {
            connection!.addModels([ outDir ]);
        });

        it('should have skipped the provided tables', () => {
            connection!.model(DATA_TYPES_TABLE_NAME);
            expect(() => connection!.model(INDICES_TABLE_NAME)).toThrow();

            expect(connection!.isDefined(DATA_TYPES_TABLE_NAME)).toBe(true);
            expect(connection!.isDefined(INDICES_TABLE_NAME)).toBe(false);
        });
    });

    describe('Transform case in table and fields names', () => {
        let connection: Sequelize | undefined;

        beforeEach(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);
        });

        afterEach(async () => {
            connection && await connection.close();
        });

        for (const transformCase of Cases) {
            it(`${transformCase.toLowerCase()} case`, async () => {
                const transformCase: Case = 'CAMEL';

                const config: IConfig = {
                    connection: sequelizeOptions,
                    metadata: {
                        schema: process.env.TEST_DB_SCHEMA || 'public',
                        case: transformCase,
                    },
                    output: {
                        outDir: outDir,
                        clean: true,
                    }
                };

                const dialect = new DialectPostgres();
                const builder = new ModelBuilder(config, dialect);
                await builder.build();

                const transformer = getTransformer(transformCase);
                await fs.access(path.join(outDir, transformer(DATA_TYPES_TABLE_NAME) + '.ts'));
                await fs.access(path.join(outDir, transformer(INDICES_TABLE_NAME) + '.ts'));

                // TODO problem with models registration due to 'require(path/to/module)'
                //  which inconsistently change case of module name
                // connection!.addModels([ outDir ]);
                // expect(connection!.isDefined(transformer(DATA_TYPES_TABLE_NAME))).toBe(true);
                // expect(connection!.isDefined(transformer(INDICES_TABLE_NAME))).toBe(true);
            });
        }
    });

    describe('Data Types', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);

            const config: IConfig = {
                connection: sequelizeOptions,
                metadata: {
                    schema: process.env.TEST_DB_SCHEMA || 'public',
                },
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            const dialect = new DialectPostgres();
            const builder = new ModelBuilder(config, dialect);
            await builder.build();
            connection!.addModels([ outDir ]);
        });

        afterAll(async () => {
            connection && await connection.close();
        });

        for (const [testName, testValue] of [
            ...numericTests,
        ]) {
            it(testName, async () => {
                const DataTypes = connection!.model(DATA_TYPES_TABLE_NAME);
                const testField = `f_${testName}`;
                const res = await DataTypes.upsert({ [testField]: testValue });

                expect(res).toBe(true);

                const rows = await DataTypes.findAll({ order: [['id', 'DESC']], limit: 1, /* raw: true */ });
                expect(rows.length).toBe(1);

                // @ts-ignore-start
                const receivedValue = rows[0][testField];
                expect(receivedValue).toBeDefined();

                if (Buffer.isBuffer(testValue)) {
                    expect(Buffer.compare(receivedValue, testValue)).toBe(0);
                }
                else {
                    expect(receivedValue).toStrictEqual(testValue);
                }
                // @ts-ignore-end
            });
        }

    });

});
