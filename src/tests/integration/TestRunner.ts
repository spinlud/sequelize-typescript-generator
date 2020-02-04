import path from 'path';
import { promises as fs } from 'fs';
import { ITestMetadata } from './ITestMetadata';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { buildSequelizeOptions } from '../environment';
import { createConnection } from '../../connection';
import { IConfig } from '../../config';
import { Dialect } from '../../dialects/Dialect';
import { DialectMySQL, DialectPostgres, DialectMSSQL } from '../../dialects';
import { getTransformer } from '../../dialects/utils';
import { ModelBuilder } from '../../builders';
import { TransformCase, TransformCases } from '../../config/IConfig';

/**
 * Workaround: deprecated GeomFromText function for MySQL
 */
const applyGeomFromTextWorkaroundMySQL = (): void => { // Reference: https://github.com/sequelize/sequelize/issues/9786
    const Sequelize = require('sequelize');
    const wkx = require('wkx');

    // @ts-ignore
    Sequelize.GEOMETRY.prototype._stringify = function _stringify(value, options) {
        return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    }
    // @ts-ignore
    Sequelize.GEOMETRY.prototype._bindParam = function _bindParam(value, options) {
        return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    }
    // @ts-ignore
    Sequelize.GEOGRAPHY.prototype._stringify = function _stringify(value, options) {
        return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    }
    // @ts-ignore
    Sequelize.GEOGRAPHY.prototype._bindParam = function _bindParam(value, options) {
        return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    }
}

/**
 *
 * @param obj
 */
const getObjectType = (obj: any): string => {
    return Object.prototype.toString.call(obj)
        .replace(/[\[\]]/g, '')
        .split(' ')[1]
        .toLowerCase();
}

/**
 *
 * @param testMetadata
 * @param connection
 */
const initTestDatabase = async (testMetadata: ITestMetadata, connection: Sequelize): Promise<void> => {
    if (testMetadata.schema) {
        const { createQuery, dropQuery } = testMetadata.schema;
        await connection.query(dropQuery);
        await connection.query(createQuery);
    }

    for (const testTable of testMetadata.testTables) {
        const { createQueries, dropQuery } = testTable;
        await connection.query(dropQuery);

        for (const createQuery of createQueries) {
            await connection.query(createQuery);
        }
    }
};

/**
 *
 * @param testMetadata
 */
const buildDialect = (testMetadata: ITestMetadata): Dialect => {
    switch (testMetadata.dialect) {
        case 'mysql':
            return new DialectMySQL();
        case 'postgres':
            return new DialectPostgres();
        case 'mssql':
            return new DialectMSSQL();
        default:
            throw new Error(`Invalid dialect ${testMetadata.dialect}`);
    }
}

export class TestRunner {
    constructor(private testMetadata: ITestMetadata) {}

    public run(): void {
        const testMetadata = this.testMetadata;

        describe(testMetadata.name, () => {
            jest.setTimeout(120000);
            const outDir = path.join(process.cwd(), 'output-models');
            const sequelizeOptions = buildSequelizeOptions(testMetadata.dialect);

            describe('Build', () => {
                const { testTables } = testMetadata;
                let connection: Sequelize | undefined;

                beforeAll(async () => {
                    connection = createConnection({ ...sequelizeOptions });
                    await connection.authenticate();
                    await initTestDatabase(testMetadata, connection);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                it('should build models', async () => {
                    const config: IConfig = {
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            indices: true,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        }
                    };

                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();
                });

                it('should register models',() => {
                    connection!.addModels([ outDir ]);

                    for (const testTable of testTables) {
                        connection!.model(testTable.name);
                        expect(connection!.isDefined(testTable.name)).toBe(true);
                    }
                });
            });

            describe('Filter --tables', () => {
                const { testTables, filterTables } = testMetadata;
                let connection: Sequelize | undefined;

                beforeAll(async () => {
                    connection = createConnection({ ...sequelizeOptions });
                    await connection.authenticate();
                    await initTestDatabase(testMetadata, connection);

                    const config: IConfig = {
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            tables: filterTables,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        }
                    };

                    const dialect = buildDialect(testMetadata);
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
                    for (const table of filterTables) {
                        connection!.model(table);
                        expect(connection!.isDefined(table)).toBe(true);
                    }

                    const skippedTables = testTables.map(t => t.name).filter(n => !filterTables.includes(n));

                    for (const table of skippedTables) {
                        expect(() => connection!.model(table)).toThrow();
                    }
                });
            });

            describe('Filter --skip-tables', () => {
                const { testTables, filterSkipTables } = testMetadata;
                let connection: Sequelize | undefined;

                beforeAll(async () => {
                    connection = createConnection({ ...sequelizeOptions });
                    await connection.authenticate();
                    await initTestDatabase(testMetadata, connection);

                    const config: IConfig = {
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            skipTables: filterSkipTables,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        }
                    };

                    const dialect = buildDialect(testMetadata);
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
                    for (const table of filterSkipTables) {
                        expect(() => connection!.model(table)).toThrow();
                    }

                    const tables = testTables.map(t => t.name).filter(n => !filterSkipTables.includes(n));

                    for (const table of tables) {
                        connection!.model(table);
                        expect(connection!.isDefined(table)).toBe(true);
                    }
                });
            });

            describe('Transform case in table and fields names', () => {
                const { testTables } = testMetadata;
                let connection: Sequelize | undefined;

                beforeEach(async () => {
                    connection = createConnection({ ...sequelizeOptions });
                    await connection.authenticate();
                    await initTestDatabase(testMetadata, connection);
                });

                afterEach(async () => {
                    connection && await connection.close();
                });

                for (const transformCase of TransformCases) {
                    it(`${transformCase.toLowerCase()} case`, async () => {
                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                case: transformCase,
                            },
                            output: {
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        const dialect = buildDialect(testMetadata);
                        const builder = new ModelBuilder(config, dialect);
                        await builder.build();

                        const transformer = getTransformer(transformCase);

                        for (const { name: tableName } of testTables) {
                            await fs.access(path.join(outDir, transformer(tableName) + '.ts'));
                        }

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
                    if (testMetadata.dialect === 'mysql') {
                        applyGeomFromTextWorkaroundMySQL();
                    }

                    connection = createConnection({ ...sequelizeOptions });
                    await connection.authenticate();
                    await initTestDatabase(testMetadata, connection);

                    const config: IConfig = {
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            indices: true,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        }
                    };

                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();

                    connection!.addModels([ outDir ]);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                for (const [typeName, typeValue] of testMetadata.dataTypes.testValues) {
                    it(typeName, async () => {
                        const dialect = buildDialect(testMetadata);
                        const DataTypes = connection!.model(testMetadata.dataTypes.dataTypesTable);
                        const columnName = `f_${typeName}`;

                        const res = await DataTypes.create({ [columnName]: typeValue });
                        // expect(res).toBe(true);
                        expect(res).toBeDefined();

                        const rows = await DataTypes.findAll({ order: [['id', 'DESC']], limit: 1 });
                        expect(rows.length).toBe(1);

                        // @ts-ignore-start
                        const receivedValue = rows[0][columnName];
                        expect(receivedValue).toBeDefined();

                        const nativeType = await testMetadata.dataTypes.getColumnNativeDataType(
                            connection!,
                            testMetadata.schema?.name ?? process.env.TEST_DB_DATABASE!,
                            testMetadata.dataTypes.dataTypesTable,
                            columnName
                        );

                        expect(dialect.jsDataTypesMap).toHaveProperty(nativeType);

                        expect(getObjectType(receivedValue))
                            .toStrictEqual(dialect.jsDataTypesMap[nativeType].toLowerCase());
                        // @ts-ignore-end
                    });
                }
            });

        });
    }
}
