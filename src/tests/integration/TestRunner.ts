import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { jest } from '@jest/globals';
import * as ts from 'typescript';
import pluralize from 'pluralize';
import { ITestMetadata } from './ITestMetadata.js';
import { Sequelize, ModelCtor } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { buildSequelizeOptions } from '../environment.js';
import { IConfig } from '../../config/index.js';
import { ITablesMetadata } from '../../dialects/Dialect.js';
import { getTransformer } from '../../dialects/utils.js';
import { createDialect } from '../../dialects/createDialect.js';
import { ModelBuilder } from '../../builders/index.js';
import { TransformCases, TransformTarget, TransformFn } from '../../config/IConfig.js';
import { compileGeneratedModels } from './compileGeneratedModels.js';
import { FORMATS, Format } from './formats.js';
import { ESLINT_MIGRATION_GUIDE_URL } from '../../lint/Linter.js';

/**
 * Return the connection or throw when it has not been initialised.
 * @param {Sequelize | undefined} connection
 * @returns {Sequelize}
 */
const requireConnection = (connection: Sequelize | undefined): Sequelize => {
    if (!connection) {
        throw new Error('Test connection is not initialised');
    }

    return connection;
};

/**
 * Type guard for a module namespace whose values are Sequelize model constructors.
 * @param {unknown} value
 * @returns {boolean}
 */
const isModelRecord = (value: unknown): value is Record<string, ModelCtor> =>
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(entry => typeof entry === 'function');

/**
 * Type guard for the native wiring module, which exports `initModels`.
 * @param {unknown} value
 * @returns {boolean}
 */
const hasInitModels = (value: unknown): value is { initModels: (sequelize: Sequelize) => unknown } =>
    typeof value === 'object' &&
    value !== null &&
    'initModels' in value &&
    typeof value.initModels === 'function';

/**
 * Register the generated models into the connection for the given format. The
 * decorators output self-registers through `addModels`; the native output is
 * wired by importing its `initModels.ts` and calling `initModels(connection)`.
 * @param {Sequelize} connection
 * @param {string} outDir
 * @param {Format} format
 * @returns {Promise<void>}
 */
const registerGeneratedModels = async (
    connection: Sequelize,
    outDir: string,
    format: Format
): Promise<void> => {
    if (format === 'decorators') {
        const models: unknown = await import(pathToFileURL(path.join(outDir, 'index.ts')).href);

        if (!isModelRecord(models)) {
            throw new Error('Generated models module did not export model constructors');
        }

        connection.addModels(Object.values(models));
        return;
    }

    const wiring: unknown = await import(pathToFileURL(path.join(outDir, 'initModels.ts')).href);

    if (!hasInitModels(wiring)) {
        throw new Error('Generated wiring module did not export initModels');
    }

    wiring.initModels(connection);
};

/**
 * Workaround: deprecated GeomFromText function for MySQL
 */
const applyGeomFromTextWorkaroundMySQL = (): void => { // Reference: https://github.com/sequelize/sequelize/issues/9786
    const require = createRequire(import.meta.url);
    const Sequelize = require('sequelize');
    const wkx = require('wkx');

    // @ts-ignore
    Sequelize.GEOMETRY.prototype._stringify = function _stringify(value, options) {
        return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    };
    // @ts-ignore
    Sequelize.GEOMETRY.prototype._bindParam = function _bindParam(value, options) {
        return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    };
    // @ts-ignore
    Sequelize.GEOGRAPHY.prototype._stringify = function _stringify(value, options) {
        return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    };
    // @ts-ignore
    Sequelize.GEOGRAPHY.prototype._bindParam = function _bindParam(value, options) {
        return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
    }
};

/**
 *
 * @param obj
 */
const getObjectType = (obj: any): string => {
    return Object.prototype.toString.call(obj)
        .replace(/[\[\]]/g, '')
        .split(' ')[1]
        .toLowerCase();
};

/**
 * Render a short line-by-line diff between two file contents, for the first
 * position where they diverge.
 * @param file
 * @param expected
 * @param actual
 */
const renderFirstDiff = (file: string, expected: string, actual: string): string => {
    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');
    const maxLines = Math.max(expectedLines.length, actualLines.length);

    for (let index = 0; index < maxLines; index++) {
        if (expectedLines[index] !== actualLines[index]) {
            return [
                `${file}: first difference at line ${index + 1}`,
                `- expected: ${JSON.stringify(expectedLines[index])}`,
                `+ actual:   ${JSON.stringify(actualLines[index])}`,
            ].join('\n');
        }
    }

    return `${file}: contents differ`;
};

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

    // Provision prerequisites (e.g. secondary schemas) before dropping or creating tables.
    if (testMetadata.setupQueries) {
        for (const setupQuery of testMetadata.setupQueries) {
            await connection.query(setupQuery);
        }
    }

    // Drop views first, then tables in reverse dependency order, so a table is
    // dropped before the tables it references (real foreign keys forbid the reverse).
    if (testMetadata.testViews) {
        for (const testView of testMetadata.testViews) {
            await connection.query(testView.dropQuery);
        }
    }

    for (const testTable of [...testMetadata.testTables].reverse()) {
        await connection.query(testTable.dropQuery);
    }

    // Create tables in dependency order, then seed rows, then create views.
    for (const testTable of testMetadata.testTables) {
        for (const createQuery of testTable.createQueries) {
            await connection.query(createQuery);
        }
    }

    for (const testTable of testMetadata.testTables) {
        if (testTable.insertQueries) {
            for (const insertQuery of testTable.insertQueries) {
                await connection.query(insertQuery);
            }
        }
    }

    if (testMetadata.testViews) {
        for (const testView of testMetadata.testViews) {
            for (const createQuery of testView.createQueries) {
                await connection.query(createQuery);
            }
        }
    }
};

export class TestRunner {
    constructor(private testMetadata: ITestMetadata) {}

    public run(): void {
        const testMetadata = this.testMetadata;

        describe(testMetadata.name, () => {
            jest.setTimeout(120000);
            const associationsFilePath = path.join(process.cwd(), 'src', 'tests', 'integration', 'associations.csv');
            const sequelizeOptions = buildSequelizeOptions(testMetadata.dialect);

            describe.each(FORMATS)('format: %s', (format: Format) => {
                // Output dir is scoped per format so runs for different formats never collide.
                const outDir = path.join(process.cwd(), 'src/tests/integration/output-models', format);
                const indexDir = path.join(outDir, 'index.ts');

                const buildModels = async (config: IConfig): Promise<void> => {
                    const dialect = createDialect(testMetadata.dialect);
                    const builder = new ModelBuilder({ ...config, format }, dialect);
                    await builder.build();
                };

                // Native always emits the association alias, so an eager load must reference it
                // by `as`; decorators only emit an alias when it differs from the default and can
                // be included by model.
                const includeTarget = (
                    model: ModelCtor,
                    alias: string
                ): ModelCtor | { model: ModelCtor; as: string } =>
                    format === 'decorators' ? model : { model, as: alias };

                describe('Build', () => {
                    const { testTables } = testMetadata;
                    let connection: Sequelize | undefined;

                    const config: IConfig = {
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name }, // Postgres
                            indices: true,
                            associationsFile: associationsFilePath,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        }
                    };

                    const test = async () => {
                        await buildModels(config);

                        await registerGeneratedModels(connection!, outDir, format);

                        for (const testTable of testTables) {
                            connection!.model(testTable.name);
                            expect(connection!.isDefined(testTable.name)).toBe(true);
                        }
                    };

                    beforeEach(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);
                    });

                    afterEach(async () => {
                        connection && await connection.close();
                    });

                    it('should build/register models (indices + associations)', async () => {
                        await test();
                    });

                    it('should build/register models (indices)', async () => {
                        delete config.metadata!.associationsFile;

                        await test();
                    });

                    it('should build/register models', async () => {
                        delete config.metadata!.associationsFile;
                        delete config.metadata!.indices;

                        await test();
                    });
                });

                describe('Compile generated models', () => {
                    let connection: Sequelize | undefined;

                    beforeAll(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                indices: true,
                                associationsFile: associationsFilePath,
                            },
                            output: {
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('type-checks under strict mode with zero diagnostics', async () => {
                        const diagnostics = await compileGeneratedModels(outDir, format);

                        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
                            getCurrentDirectory: () => outDir,
                            getCanonicalFileName: (fileName) => fileName,
                            getNewLine: () => '\n',
                        });

                        expect(formatted).toBe('');
                        expect(diagnostics).toHaveLength(0);
                    });
                });

                describe('Tables', () => {
                    const { testTables, filterTables } = testMetadata;
                    // A dedicated output dir keeps the filtered generation out of the module
                    // cache the full-set blocks populate, so native's initModels reflects it.
                    const tablesOutDir = path.join(
                        process.cwd(), 'src/tests/integration/output-models', `${format}-tables`
                    );
                    let connection: Sequelize | undefined;

                    beforeAll(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                tables: filterTables,
                            },
                            output: {
                                outDir: tablesOutDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('type-checks the generated output under strict mode', async () => {
                        const diagnostics = await compileGeneratedModels(tablesOutDir, format);

                        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
                            getCurrentDirectory: () => tablesOutDir,
                            getCanonicalFileName: (fileName) => fileName,
                            getNewLine: () => '\n',
                        });

                        expect(formatted).toBe('');
                        expect(diagnostics).toHaveLength(0);
                    });

                    it('should add only the provided tables', async () => {
                        await registerGeneratedModels(connection!, tablesOutDir, format);

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

                describe('Skip tables', () => {
                    const { testTables, filterSkipTables } = testMetadata;
                    // A dedicated output dir keeps the filtered generation out of the module
                    // cache the full-set blocks populate, so native's initModels reflects it.
                    const skipTablesOutDir = path.join(
                        process.cwd(), 'src/tests/integration/output-models', `${format}-skip-tables`
                    );
                    let connection: Sequelize | undefined;

                    beforeAll(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                skipTables: filterSkipTables,
                            },
                            output: {
                                outDir: skipTablesOutDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('type-checks the generated output under strict mode', async () => {
                        const diagnostics = await compileGeneratedModels(skipTablesOutDir, format);

                        const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
                            getCurrentDirectory: () => skipTablesOutDir,
                            getCanonicalFileName: (fileName) => fileName,
                            getNewLine: () => '\n',
                        });

                        expect(formatted).toBe('');
                        expect(diagnostics).toHaveLength(0);
                    });

                    it('should skip the provided tables', async () => {
                        await registerGeneratedModels(connection!, skipTablesOutDir, format);

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

                if (testMetadata.testViews) {
                    describe('Skip views', () => {
                        const { testTables } = testMetadata;
                        const testViews = testMetadata.testViews!;
                        // A dedicated output dir keeps this generation out of the module cache
                        // the full-set blocks populate, so native's initModels reflects it.
                        const skipViewsOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-skip-views`
                        );
                        let connection: Sequelize | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {
                                    ...testMetadata.schema && { schema: testMetadata.schema.name },
                                    noViews: true,
                                },
                                output: {
                                    outDir: skipViewsOutDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('type-checks the generated output under strict mode', async () => {
                            const diagnostics = await compileGeneratedModels(skipViewsOutDir, format);

                            const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
                                getCurrentDirectory: () => skipViewsOutDir,
                                getCanonicalFileName: (fileName) => fileName,
                                getNewLine: () => '\n',
                            });

                            expect(formatted).toBe('');
                            expect(diagnostics).toHaveLength(0);
                        });

                        it('should skip views', async () => {
                            await registerGeneratedModels(connection!, skipViewsOutDir, format);

                            for (const { name: tableName } of testTables) {
                                connection!.model(tableName);
                                expect(connection!.isDefined(tableName)).toBe(true);
                            }

                            for (const { name: viewName } of testViews) {
                                expect(() => connection!.model(viewName)).toThrow();
                            }
                        });
                    });
                }

                describe('Transform case in table and fields names', () => {
                    const { testTables } = testMetadata;
                    let connection: Sequelize | undefined;

                    beforeEach(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);
                    });

                    afterEach(async () => {
                        connection && await connection.close();
                    });

                    for (const transformCase of TransformCases) {
                        it(`${transformCase} case`, async () => {
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

                            await buildModels(config);

                            const transformer = getTransformer(transformCase);

                            for (const { name: tableName } of testTables) {
                                await fs.access(path.join(outDir, transformer(tableName, TransformTarget.MODEL) + '.ts'));
                            }

                            // TODO problem with models registration due to 'require(path/to/module)'
                            //  which inconsistently change case of module name
                            // connection!.addModels([ outDir ]);
                            // expect(connection!.isDefined(transformer(DATA_TYPES_TABLE_NAME))).toBe(true);
                            // expect(connection!.isDefined(transformer(INDICES_TABLE_NAME))).toBe(true);
                        });
                    }

                    it(`Different case for model and column`, async () => {
                        const modelCase = 'CONST';
                        const columnCase = 'CAMEL';

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                case: {
                                    [TransformTarget.MODEL]: modelCase,
                                    [TransformTarget.COLUMN]: columnCase
                                },
                            },
                            output: {
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);

                        const modelTransformer = getTransformer(modelCase);

                        for (const { name: tableName } of testTables) {
                            await fs.access(path.join(outDir, modelTransformer(tableName, TransformTarget.MODEL) + '.ts'));
                        }
                    });

                    it(`Custom transformer`, async () => {
                        const transformer: TransformFn = (value, target) => {
                            if (target === TransformTarget.MODEL) {
                                return value.toUpperCase();
                            }

                            return value.toLowerCase();
                        }

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                case: transformer,
                            },
                            output: {
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);

                        for (const { name: tableName } of testTables) {
                            await fs.access(path.join(outDir, transformer(tableName, TransformTarget.MODEL) + '.ts'));
                        }
                    });
                });

                describe('Data Types', () => {
                    let connection: Sequelize | undefined;

                    beforeAll(async () => {
                        if (testMetadata.dialect === 'mysql') {
                            applyGeomFromTextWorkaroundMySQL();
                        }

                        connection = new Sequelize({ ...sequelizeOptions });
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

                        await buildModels(config);

                        await registerGeneratedModels(connection!, outDir, format);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it.each(testMetadata.dataTypes.testValues)('%s', async (typeName, typeValue) => {
                        const dialect = createDialect(testMetadata.dialect);
                        const DataTypes = connection!.model(testMetadata.dataTypes.dataTypesTable);
                        const columnName = `f_${typeName}`;

                        const res = await DataTypes.create({ [columnName]: typeValue });
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

                        expect(dialect.mapDbTypeToJs(nativeType)).toBeDefined();

                        const receivedValueType = getObjectType(receivedValue);
                        console.log(typeName, typeValue, receivedValue, receivedValueType);
                        const expectedValueType = dialect.mapDbTypeToJs(nativeType).toLowerCase();

                        if (receivedValueType === 'array') {
                            expect(expectedValueType.includes(receivedValueType)).toBe(true);
                        }
                        // Kind of an hack: the problem here is that BIT(n) type stores numbers in binary format (e.g. b'1000')
                        // but node MySQL driver convert it to Buffer in javascript while the user generally wants to store it
                        // as a number (or boolean in case of BIT(1) to simulate a boolean flag). So here we are converting
                        // the received value to a number before comparing it to the original value.
                        else if ((dialect.name === 'mysql' || dialect.name === 'mariadb') &&
                            typeName === 'bit' && receivedValueType === 'uint8array') {
                            expect(parseInt(receivedValue[0], 10)).toStrictEqual(typeValue);
                        }
                        else {
                            expect(receivedValueType).toStrictEqual(expectedValueType);
                        }
                        // @ts-ignore-end
                    });
                });

                if (testMetadata.arrayTypes) {
                    const arrayTypes = testMetadata.arrayTypes;

                    describe('Array types', () => {
                        // A dedicated output dir keeps this generation out of the module cache
                        // the other blocks populate, so native's initModels reflects it.
                        const arrayOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-array-types`
                        );
                        let connection: Sequelize | undefined;
                        let generatedModel = '';
                        const warnMessages: string[] = [];

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {
                                    ...testMetadata.schema && { schema: testMetadata.schema.name },
                                },
                                output: {
                                    outDir: arrayOutDir,
                                    clean: true,
                                }
                            };

                            const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
                                warnMessages.push(args.map(arg => String(arg)).join(' '));
                            });

                            try {
                                await buildModels(config);
                            }
                            finally {
                                warnSpy.mockRestore();
                            }

                            generatedModel = await fs.readFile(
                                path.join(arrayOutDir, `${arrayTypes.arrayTypesTable}.ts`), 'utf8'
                            );

                            await registerGeneratedModels(connection!, arrayOutDir, format);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('emits the array data type expression and the array TypeScript type', () => {
                            for (const expected of arrayTypes.expected) {
                                const typeExpression = format === 'decorators'
                                    ? expected.decoratorType
                                    : expected.nativeType;

                                expect(generatedModel).toContain(typeExpression);
                                expect(generatedModel).toContain(expected.tsType);
                            }
                        });

                        it('does not warn about unknown data type mappings', () => {
                            expect(warnMessages.some(message => message.includes('Unknown data type mapping')))
                                .toBe(false);
                        });

                        it('round-trips array values through the database', async () => {
                            const model = requireConnection(connection).model(arrayTypes.arrayTypesTable);

                            const row: Record<string, unknown> = {};

                            for (const expected of arrayTypes.expected) {
                                row[expected.column] = expected.value;
                            }

                            const created = await model.create(row);
                            expect(created).toBeDefined();

                            const [stored] = await model.findAll({ order: [['id', 'DESC']], limit: 1 });
                            const storedJson = stored.toJSON();

                            for (const expected of arrayTypes.expected) {
                                expect(Array.isArray(storedJson[expected.column])).toBe(true);
                                expect(storedJson[expected.column]).toHaveLength(expected.value.length);
                            }
                        });
                    });
                }

                if (testMetadata.jsonTypes) {
                    const jsonTypes = testMetadata.jsonTypes;

                    describe('JSON types', () => {
                        // A dedicated output dir keeps this generation out of the module cache
                        // the other blocks populate, so native's initModels reflects it.
                        const jsonOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-json-types`
                        );
                        let connection: Sequelize | undefined;
                        let generatedModel = '';
                        let supportFile = '';

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {
                                    ...testMetadata.schema && { schema: testMetadata.schema.name },
                                },
                                output: {
                                    outDir: jsonOutDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);

                            generatedModel = await fs.readFile(
                                path.join(jsonOutDir, `${jsonTypes.jsonTypesTable}.ts`), 'utf8'
                            );
                            supportFile = await fs.readFile(path.join(jsonOutDir, 'jsonType.ts'), 'utf8');

                            await registerGeneratedModels(connection!, jsonOutDir, format);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('emits the shared Json support file with the recursive union', () => {
                            expect(supportFile).toContain('export type Json =');
                            expect(supportFile).toContain('Json[]');
                            expect(supportFile).toContain('[key: string]: Json');
                        });

                        it('type-only imports Json into the model file', () => {
                            expect(generatedModel).toContain('import type { Json } from "./jsonType"');
                        });

                        it('emits the data type expression and TypeScript type per column', () => {
                            for (const expected of jsonTypes.expected) {
                                const typeExpression = format === 'decorators'
                                    ? expected.decoratorType
                                    : expected.nativeType;

                                expect(generatedModel).toContain(typeExpression);

                                const typePattern = new RegExp(`${expected.column}[?!:][^\\n]*\\b${expected.tsType}\\b`);
                                expect(generatedModel).toMatch(typePattern);

                                // A plain (non-JSON) column must not be typed as Json.
                                if (expected.tsType !== 'Json') {
                                    expect(generatedModel).not.toMatch(new RegExp(`${expected.column}[?!:][^\\n]*Json`));
                                }
                            }
                        });

                        it('round-trips an object, an array and a top-level scalar', async () => {
                            const jsonColumn = jsonTypes.expected.find(expected => expected.tsType === 'Json');
                            expect(jsonColumn).toBeDefined();

                            const model = requireConnection(connection).model(jsonTypes.jsonTypesTable);
                            const column = jsonColumn!.column;
                            const values: unknown[] = [
                                jsonTypes.roundTripValues.object,
                                jsonTypes.roundTripValues.array,
                                jsonTypes.roundTripValues.scalar,
                            ];

                            for (const value of values) {
                                const created = await model.create({ [column]: value });
                                const id = created.get('id');

                                const reloaded = await model.findByPk(id);
                                expect(reloaded).not.toBeNull();
                                expect(reloaded!.toJSON()[column]).toEqual(value);
                            }
                        });
                    });
                }

                describe('Associations', () => {
                    let connection: Sequelize | undefined;

                    beforeAll(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);

                        const config: IConfig = {
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                indices: true,
                                associationsFile: associationsFilePath,
                            },
                            output: {
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);

                        await registerGeneratedModels(connection!, outDir, format);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('1:1', async () => {
                        const personModel = connection!.model(testMetadata.associations.leftTableOneToOne);
                        const passportModel = connection!.model(testMetadata.associations.rightTableOneToOne);
                        const personField = pluralize.singular(testMetadata.associations.leftTableOneToOne);
                        const passportField = pluralize.singular(testMetadata.associations.rightTableOneToOne);

                        const personRows = (await personModel.findAll({  include: [ includeTarget(passportModel, passportField) ] }))
                            .map(e => e.toJSON());

                        for (const person of personRows) {
                            expect(person).toHaveProperty(passportField);
                            expect(person[passportField]).toBeDefined();
                            expect(Array.isArray(person[passportField])).toBeFalsy();
                        }

                        const passportRows = (await passportModel.findAll({  include: [ includeTarget(personModel, personField) ] }))
                            .map(e => e.toJSON());

                        for (const passport of passportRows) {
                            expect(passport).toHaveProperty(personField);
                            expect(passport[personField]).toBeDefined();
                            expect(Array.isArray(passport[personField])).toBeFalsy();
                        }
                    });

                    it('1:N', async () => {
                        const racesModel = connection!.model(testMetadata.associations.leftTableOneToMany);
                        const unitsModel = connection!.model(testMetadata.associations.rightTableOneToMany);
                        const raceField = pluralize.singular(testMetadata.associations.leftTableOneToMany);
                        const unitsField = pluralize.plural(testMetadata.associations.rightTableOneToMany);

                        const racesRows = (await racesModel.findAll({  include: [ includeTarget(unitsModel, unitsField) ] }))
                            .map(e => e.toJSON());

                        for (const race of racesRows) {
                            expect(race).toHaveProperty(unitsField);
                            expect(Array.isArray(race[unitsField])).toBe(true);

                            switch (race.race_name) {
                                case 'Orcs':
                                    expect(race[unitsField].length).toBe(2);
                                    break;
                                case 'Humans':
                                    expect(race[unitsField].length).toBe(1);
                                    break;
                                case 'Night Elves':
                                    expect(race[unitsField].length).toBe(2);
                                    break;
                                case 'Undead':
                                    expect(race[unitsField].length).toBe(2);
                                    break;
                            }
                        }

                        const unitsRows = (await unitsModel.findAll({  include: [ includeTarget(racesModel, raceField) ] }))
                            .map(e => e.toJSON());

                        for (const unit of unitsRows) {
                            expect(unit).toHaveProperty(raceField);
                            expect(unit[raceField]).toBeDefined();
                            expect(Array.isArray(unit[raceField])).toBeFalsy();
                        }
                    });

                    it('N:N', async () => {
                        const authorsModel = connection!.model(testMetadata.associations.leftTableManyToMany);
                        const booksModel = connection!.model(testMetadata.associations.rightTableManyToMany);
                        const authorsField = pluralize.plural(testMetadata.associations.leftTableManyToMany);
                        const booksField = pluralize.plural(testMetadata.associations.rightTableManyToMany);

                        const authorsRows = (await authorsModel.findAll({  include: [ includeTarget(booksModel, booksField) ] }))
                            .map(e => e.toJSON());

                        for (const author of authorsRows) {
                            expect(author).toHaveProperty(booksField);
                            expect(Array.isArray(author[booksField])).toBe(true);
                            expect(author[booksField].length).toBeGreaterThanOrEqual(1);
                        }

                        const booksRows = (await booksModel.findAll({  include: [ includeTarget(authorsModel, authorsField) ] }))
                            .map(e => e.toJSON());

                        for (const book of booksRows) {
                            expect(book).toHaveProperty(authorsField);
                            expect(Array.isArray(book[authorsField])).toBe(true);
                            expect(book[authorsField].length).toBeGreaterThanOrEqual(1);
                        }
                    });
                });

                describe('Foreign keys', () => {
                    let connection: Sequelize | undefined;
                    let tablesMetadata: ITablesMetadata;

                    const buildForeignKeyConfig = (metadata: IConfig['metadata']): IConfig => ({
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            ...metadata,
                        },
                        output: {
                            outDir: outDir,
                            clean: true,
                        },
                    });

                    beforeAll(async () => {
                        connection = new Sequelize({ ...sequelizeOptions });
                        await connection.authenticate();
                        await initTestDatabase(testMetadata, connection);

                        const dialect = createDialect(testMetadata.dialect);
                        tablesMetadata = await dialect.buildTablesMetadata(buildForeignKeyConfig({}));
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('exposes the expected constraints per table', () => {
                        for (const [tableName, expected] of Object.entries(testMetadata.expectedForeignKeys)) {
                            expect(tablesMetadata[tableName].foreignKeys).toEqual(expected);
                        }
                    });

                    if (Object.keys(testMetadata.expectedForeignKeys).length) {
                        it('copies a single-column foreign key onto its source column', () => {
                            const [unitsConstraint] = testMetadata.expectedForeignKeys['units'];

                            expect(tablesMetadata['units'].columns['race_id'].foreignKey).toMatchObject({
                                name: 'race_id',
                                targetModel: 'races',
                                targetKey: 'race_id',
                                constraintName: unitsConstraint.constraintName,
                                onDelete: unitsConstraint.onDelete,
                                onUpdate: unitsConstraint.onUpdate,
                                isUnique: false,
                            });
                        });

                        it('does not copy composite foreign keys onto columns', () => {
                            for (const column of Object.values(tablesMetadata['shipments'].columns)) {
                                expect(column.foreignKey).toBeUndefined();
                            }
                        });

                        it('flags a unique single-column foreign key', () => {
                            expect(tablesMetadata['profiles'].columns['person_id'].foreignKey)
                                .toMatchObject({ isUnique: true });
                        });

                        it('resolves a self-referencing foreign key', () => {
                            expect(tablesMetadata['employees'].columns['manager_id'].foreignKey)
                                .toMatchObject({ targetModel: 'employees' });
                        });

                        it('keeps the constraint record but drops the column link when the target is excluded', async () => {
                            const dialect = createDialect(testMetadata.dialect);
                            const filtered = await dialect.buildTablesMetadata(buildForeignKeyConfig({ tables: ['units'] }));

                            expect(filtered['units'].foreignKeys).toEqual(testMetadata.expectedForeignKeys['units']);
                            expect(filtered['units'].columns['race_id'].foreignKey).toBeUndefined();
                        });
                    }
                });

                describe('Association discovery', () => {
                    const unitsTable = testMetadata.associations.rightTableOneToMany;
                    const racesTable = testMetadata.associations.leftTableOneToMany;
                    const personTable = testMetadata.associations.leftTableOneToOne;
                    const profilesTable = 'profiles';
                    const employeesTable = 'employees';
                    const shipmentsTable = 'shipments';
                    const orderLinesTable = 'order_lines';

                    // Aliases discovery derives from the database names, mirroring the generator rules.
                    const raceAlias = pluralize.singular(racesTable);
                    const unitsAlias = pluralize.plural(unitsTable);
                    const personAlias = pluralize.singular(personTable);
                    const profileAlias = pluralize.singular(profilesTable);
                    const MANAGER_ALIAS = 'manager';
                    const MANAGER_EMPLOYEES_ALIAS = 'managerEmployees';

                    const buildDiscoveryConfig = (
                        metadata: IConfig['metadata'],
                        discoveryOutDir: string
                    ): IConfig => ({
                        connection: sequelizeOptions,
                        metadata: {
                            ...testMetadata.schema && { schema: testMetadata.schema.name },
                            ...metadata,
                        },
                        output: {
                            outDir: discoveryOutDir,
                            clean: true,
                        },
                    });

                    const loadModelsInto = async (targetConnection: Sequelize, dir: string): Promise<void> => {
                        await registerGeneratedModels(targetConnection, dir, format);
                    };

                    interface IReferentialActionOptions {
                        onDelete?: string;
                        onUpdate?: string;
                    }

                    // Referential actions live on the runtime association options, which Sequelize
                    // does not surface on the typed Association base class.
                    const readReferentialActions = (association: unknown): IReferentialActionOptions => {
                        if (typeof association !== 'object' || association === null || !('options' in association)) {
                            return {};
                        }

                        const options: unknown = association.options;

                        if (typeof options !== 'object' || options === null) {
                            return {};
                        }

                        const onDelete = 'onDelete' in options && typeof options.onDelete === 'string'
                            ? options.onDelete
                            : undefined;
                        const onUpdate = 'onUpdate' in options && typeof options.onUpdate === 'string'
                            ? options.onUpdate
                            : undefined;

                        return { onDelete, onUpdate };
                    };

                    describe('discovered from foreign keys', () => {
                        const discoveredOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-assoc-discovered`
                        );
                        let connection: Sequelize | undefined;
                        const warnMessages: string[] = [];

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
                                warnMessages.push(args.map(arg => String(arg)).join(' '));
                            });

                            try {
                                await buildModels(buildDiscoveryConfig({ indices: true }, discoveredOutDir));
                            }
                            finally {
                                warnSpy.mockRestore();
                            }

                            await loadModelsInto(requireConnection(connection), discoveredOutDir);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('derives a one-to-many association between units and races', async () => {
                            const racesModel = requireConnection(connection).model(racesTable);
                            const unitsModel = requireConnection(connection).model(unitsTable);

                            expect(racesModel.associations[unitsAlias].associationType).toBe('HasMany');
                            expect(racesModel.associations[unitsAlias].foreignKey).toBe('race_id');
                            expect(unitsModel.associations[raceAlias].associationType).toBe('BelongsTo');
                            expect(unitsModel.associations[raceAlias].foreignKey).toBe('race_id');

                            const raceRows: Record<string, unknown>[] =
                                (await racesModel.findAll({ include: [includeTarget(unitsModel, unitsAlias)] })).map(row => row.toJSON());

                            for (const race of raceRows) {
                                const relatedUnits = race[unitsAlias];
                                expect(Array.isArray(relatedUnits)).toBe(true);

                                const raceName = race['race_name'];

                                if (Array.isArray(relatedUnits) && typeof raceName === 'string') {
                                    switch (raceName) {
                                        case 'Orcs': expect(relatedUnits.length).toBe(2); break;
                                        case 'Humans': expect(relatedUnits.length).toBe(1); break;
                                        case 'Night Elves': expect(relatedUnits.length).toBe(2); break;
                                        case 'Undead': expect(relatedUnits.length).toBe(2); break;
                                    }
                                }
                            }

                            const unitRows: Record<string, unknown>[] =
                                (await unitsModel.findAll({ include: [includeTarget(racesModel, raceAlias)] })).map(row => row.toJSON());

                            for (const unit of unitRows) {
                                expect(unit[raceAlias]).toBeDefined();
                                expect(Array.isArray(unit[raceAlias])).toBe(false);
                            }
                        });

                        it('derives a one-to-one association between profiles and person', async () => {
                            const personModel = requireConnection(connection).model(personTable);
                            const profilesModel = requireConnection(connection).model(profilesTable);

                            expect(personModel.associations[profileAlias].associationType).toBe('HasOne');
                            expect(profilesModel.associations[personAlias].associationType).toBe('BelongsTo');

                            const personRows: Record<string, unknown>[] =
                                (await personModel.findAll({ include: [includeTarget(profilesModel, profileAlias)] })).map(row => row.toJSON());

                            for (const person of personRows) {
                                expect(person[profileAlias]).toBeDefined();
                                expect(Array.isArray(person[profileAlias])).toBe(false);
                            }
                        });

                        it('skips composite foreign keys and warns with the constraint name', () => {
                            const shipmentsModel = requireConnection(connection).model(shipmentsTable);
                            const orderLinesModel = requireConnection(connection).model(orderLinesTable);

                            expect(Object.keys(shipmentsModel.associations)).toHaveLength(0);
                            expect(Object.keys(orderLinesModel.associations)).toHaveLength(0);

                            const [compositeConstraint] = testMetadata.expectedForeignKeys[shipmentsTable];
                            expect(warnMessages.some(message => message.includes(compositeConstraint.constraintName)))
                                .toBe(true);
                        });

                        it('derives aliased self-references on employees', async () => {
                            const employeesModel = requireConnection(connection).model(employeesTable);

                            expect(employeesModel.associations[MANAGER_ALIAS].associationType).toBe('BelongsTo');
                            expect(employeesModel.associations[MANAGER_EMPLOYEES_ALIAS].associationType).toBe('HasMany');

                            const employeeRows: Record<string, unknown>[] =
                                (await employeesModel.findAll({ include: [{ association: MANAGER_ALIAS }] }))
                                    .map(row => row.toJSON());

                            const managed = employeeRows.find(
                                row => row['manager_id'] !== null && row['manager_id'] !== undefined
                            );
                            expect(managed).toBeDefined();

                            if (managed) {
                                expect(managed[MANAGER_ALIAS]).toBeDefined();
                                expect(Array.isArray(managed[MANAGER_ALIAS])).toBe(false);
                            }
                        });

                        it('carries referential actions onto the discovered association', () => {
                            const unitsModel = requireConnection(connection).model(unitsTable);
                            const [unitsForeignKey] = testMetadata.expectedForeignKeys[unitsTable];
                            const referentialActions = readReferentialActions(unitsModel.associations[raceAlias]);

                            expect(referentialActions.onDelete).toBe(unitsForeignKey.onDelete);

                            // Some dialects (SQL Server) normalize ON UPDATE RESTRICT to NO ACTION and emit no rule.
                            if (unitsForeignKey.onUpdate !== 'NO ACTION') {
                                expect(referentialActions.onUpdate).toBe(unitsForeignKey.onUpdate);
                            }
                        });
                    });

                    describe('overridden by the associations file', () => {
                        const csvOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-assoc-csv`
                        );
                        let connection: Sequelize | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            await buildModels(buildDiscoveryConfig(
                                { indices: true, associationsFile: associationsFilePath }, csvOutDir
                            ));

                            await loadModelsInto(requireConnection(connection), csvOutDir);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('exposes only the associations declared in the file', () => {
                            const unitsModel = requireConnection(connection).model(unitsTable);
                            const racesModel = requireConnection(connection).model(racesTable);
                            const personModel = requireConnection(connection).model(personTable);

                            expect(Object.keys(unitsModel.associations).sort()).toEqual([raceAlias].sort());
                            expect(Object.keys(racesModel.associations).sort()).toEqual([unitsAlias].sort());
                            expect(Object.keys(personModel.associations).sort())
                                .toEqual(['passport', profileAlias].sort());
                        });

                        it('emits no referential actions for file-declared associations', async () => {
                            if (format === 'decorators') {
                                // Decorators carry the units wiring on the units model file.
                                const generatedUnits = await fs.readFile(path.join(csvOutDir, `${unitsTable}.ts`), 'utf8');
                                expect(generatedUnits).not.toContain('onDelete');
                                return;
                            }

                            // Native wires every association in initModels.ts; only the file-declared
                            // units<->races pair must be free of referential actions (other pairs come
                            // from discovery and keep theirs).
                            const generatedWiring = await fs.readFile(path.join(csvOutDir, 'initModels.ts'), 'utf8');
                            const csvPairStatements = [
                                ...generatedWiring.matchAll(/(?:units\.belongsTo\(races|races\.hasMany\(units)[^;]*;/g),
                            ].map(match => match[0]);

                            expect(csvPairStatements.length).toBeGreaterThan(0);

                            for (const statement of csvPairStatements) {
                                expect(statement).not.toContain('onDelete');
                            }
                        });
                    });

                    describe('disabled with associations: false', () => {
                        const disabledOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-assoc-none`
                        );
                        let connection: Sequelize | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            await buildModels(buildDiscoveryConfig({ indices: true, associations: false }, disabledOutDir));
                            await loadModelsInto(requireConnection(connection), disabledOutDir);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('generates no associations but keeps the foreign key decorator', async () => {
                            const tables = [
                                unitsTable, racesTable, personTable, profilesTable,
                                employeesTable, shipmentsTable, orderLinesTable,
                            ];

                            for (const tableName of tables) {
                                const model = requireConnection(connection).model(tableName);
                                expect(Object.keys(model.associations)).toHaveLength(0);
                            }

                            const generatedUnits = await fs.readFile(
                                path.join(disabledOutDir, `${unitsTable}.ts`), 'utf8'
                            );

                            // The foreign key stays branded even with associations disabled: a
                            // `@ForeignKey` decorator for decorators, a `ForeignKey<...>` type for native.
                            if (format === 'decorators') {
                                expect(generatedUnits).toContain(`@ForeignKey(() => ${racesTable})`);
                            }
                            else {
                                expect(generatedUnits).toContain(`ForeignKey<${racesTable}[`);
                            }
                        });
                    });

                    describe('with camel case', () => {
                        const camelOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-assoc-camel`
                        );
                        let connection: Sequelize | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            await buildModels(buildDiscoveryConfig({ indices: true, case: 'CAMEL' }, camelOutDir));
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('camel-cases association aliases and foreign keys', async () => {
                            const generatedEmployees = await fs.readFile(
                                path.join(camelOutDir, `${employeesTable}.ts`), 'utf8'
                            );

                            if (format === 'decorators') {
                                expect(generatedEmployees).toContain('managerEmployees?: employees[]');
                                expect(generatedEmployees).toContain('foreignKey: "managerId"');
                            }
                            else {
                                // Native declares the association on the model and wires the foreign key in initModels.ts.
                                expect(generatedEmployees).toContain('managerEmployees?: NonAttribute<employees[]>');

                                const generatedWiring = await fs.readFile(
                                    path.join(camelOutDir, 'initModels.ts'), 'utf8'
                                );
                                expect(generatedWiring).toContain('foreignKey: "managerId"');
                            }
                        });
                    });
                });

                if (testMetadata.paranoidTable) {
                    const paranoidTableName = testMetadata.paranoidTable;

                    describe('Paranoid', () => {
                        let connection: Sequelize | undefined;

                        // A dedicated output directory per test keeps the freshly generated
                        // models out of the module cache populated by the other describe blocks.
                        const buildParanoidConfig = (metadata: IConfig['metadata'], paranoidOutDir: string): IConfig => ({
                            connection: sequelizeOptions,
                            metadata: {
                                ...testMetadata.schema && { schema: testMetadata.schema.name },
                                ...metadata,
                            },
                            output: {
                                outDir: paranoidOutDir,
                                clean: true,
                            },
                        });

                        const loadModels = async (paranoidOutDir: string): Promise<void> => {
                            await registerGeneratedModels(requireConnection(connection), paranoidOutDir, format);
                        };

                        beforeEach(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);
                        });

                        afterEach(async () => {
                            connection && await connection.close();
                        });

                        it('emits paranoid options and soft-deletes rows', async () => {
                            const paranoidOutDir = path.join(
                                process.cwd(), 'src/tests/integration/output-models', `${format}-paranoid-enabled`
                            );

                            await buildModels(buildParanoidConfig({ timestamps: true, paranoid: true }, paranoidOutDir));
                            await loadModels(paranoidOutDir);

                            const model = requireConnection(connection).model(paranoidTableName);

                            expect(model.options.paranoid).toBe(true);
                            expect(model.options.deletedAt).toBe('deleted_at');

                            const created = await model.create({ id: 1, name: 'to delete' });
                            expect(created).toBeDefined();

                            await created.destroy();

                            const visibleRows = await model.findAll();
                            expect(visibleRows.length).toBe(0);

                            const allRows = await model.findAll({ paranoid: false });
                            expect(allRows.length).toBe(1);
                            expect(allRows[0].get('deleted_at')).toBeTruthy();
                        });

                        it('ignores paranoid and warns when timestamps are missing', async () => {
                            const paranoidOutDir = path.join(
                                process.cwd(), 'src/tests/integration/output-models', `${format}-paranoid-no-timestamps`
                            );
                            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

                            try {
                                await buildModels(buildParanoidConfig({ paranoid: true }, paranoidOutDir));
                                await loadModels(paranoidOutDir);

                                const model = requireConnection(connection).model(paranoidTableName);

                                expect(model.options.paranoid).toBeFalsy();
                                expect(warnSpy).toHaveBeenCalledWith('[WARNING]', expect.stringContaining('timestamps'));
                            }
                            finally {
                                warnSpy.mockRestore();
                            }
                        });
                    });
                }

                if (testMetadata.columnComment) {
                    const columnComment = testMetadata.columnComment;

                    describe('Column comments', () => {
                        // A dedicated output dir keeps this generation out of the module cache
                        // the other blocks populate.
                        const commentsOutDir = path.join(
                            process.cwd(), 'src/tests/integration/output-models', `${format}-column-comments`
                        );
                        let connection: Sequelize | undefined;
                        let generatedModel = '';

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {
                                    ...testMetadata.schema && { schema: testMetadata.schema.name },
                                },
                                output: {
                                    outDir: commentsOutDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);

                            generatedModel = await fs.readFile(
                                path.join(commentsOutDir, `${columnComment.table}.ts`), 'utf8'
                            );
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('emits the column comment as a JSDoc leading comment', () => {
                            expect(generatedModel).toContain(`/** ${columnComment.comment} */`);

                            // The JSDoc precedes the commented column's declaration.
                            const jsDocPattern = new RegExp(
                                `/\\*\\* ${columnComment.comment} \\*/[\\s\\S]*?\\b${columnComment.column}\\b`
                            );
                            expect(generatedModel).toMatch(jsDocPattern);
                        });
                    });
                }

                if (testMetadata.triggerTable && testMetadata.secondarySchemaTable) {
                    const triggerTableName = testMetadata.triggerTable;
                    const secondarySchemaTable = testMetadata.secondarySchemaTable;

                    describe('Schema and triggers', () => {
                        let connection: Sequelize | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            // No schema filter so both schemas are generated.
                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {},
                                output: {
                                    outDir: outDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);

                            await registerGeneratedModels(requireConnection(connection), outDir, format);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('emits hasTrigger and can insert into a triggered table', async () => {
                            const model = requireConnection(connection).model(triggerTableName);

                            expect(model.options.hasTrigger).toBe(true);

                            const created = await model.create({ name: 'audited row' });
                            expect(created).toBeDefined();
                        });

                        it('emits the secondary schema and can query its table', async () => {
                            const model = requireConnection(connection).model(secondarySchemaTable.name);

                            expect(model.getTableName()).toMatchObject({
                                schema: secondarySchemaTable.schema,
                                tableName: secondarySchemaTable.name,
                                delimiter: '.',
                            });

                            const rows = await model.findAll();
                            expect(Array.isArray(rows)).toBe(true);
                        });

                        it('emits the default schema on tables in it', () => {
                            const model = requireConnection(connection).model('races');

                            expect(model.options.schema).toBe('dbo');
                        });
                    });
                }

                if (testMetadata.dialect === 'sqlite') {
                    describe('Golden fixture', () => {
                        const goldenDir = path.join(
                            process.cwd(), 'src', 'tests', 'integration', 'sqlite', 'golden', format
                        );
                        let connection: Sequelize | undefined;
                        let tempDir: string | undefined;

                        beforeAll(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);

                            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-golden-'));

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: {
                                    indices: true,
                                    associationsFile: associationsFilePath,
                                },
                                output: {
                                    outDir: tempDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                            tempDir && await fs.rm(tempDir, { recursive: true, force: true });
                        });

                        it('matches the committed golden files byte-for-byte', async () => {
                            const generatedFiles = (await fs.readdir(tempDir!))
                                .filter(file => file.endsWith('.ts'))
                                .sort();

                            // GOLDEN_UPDATE regenerates the fixture instead of comparing against it.
                            if (process.env.GOLDEN_UPDATE) {
                                await fs.rm(goldenDir, { recursive: true, force: true });
                                await fs.mkdir(goldenDir, { recursive: true });

                                for (const file of generatedFiles) {
                                    await fs.copyFile(path.join(tempDir!, file), path.join(goldenDir, file));
                                }

                                return;
                            }

                            const goldenFiles = (await fs.readdir(goldenDir))
                                .filter(file => file.endsWith('.ts'))
                                .sort();

                            expect(generatedFiles).toEqual(goldenFiles);

                            const differingFiles: string[] = [];
                            let firstDiff = '';

                            for (const file of goldenFiles) {
                                const expected = await fs.readFile(path.join(goldenDir, file), 'utf8');
                                const actual = await fs.readFile(path.join(tempDir!, file), 'utf8');

                                if (expected !== actual) {
                                    differingFiles.push(file);

                                    if (!firstDiff) {
                                        firstDiff = renderFirstDiff(file, expected, actual);
                                    }
                                }
                            }

                            if (differingFiles.length) {
                                throw new Error(
                                    `Generated output differs from golden fixture for: ${differingFiles.join(', ')}\n\n` +
                                    `${firstDiff}\n\n` +
                                    `Run 'npm run test:golden:update' to refresh the fixture if the change is expected.`
                                );
                            }
                        });
                    });

                    describe('Lint (-L)', () => {
                        let connection: Sequelize | undefined;

                        beforeEach(async () => {
                            connection = new Sequelize({ ...sequelizeOptions });
                            await connection.authenticate();
                            await initTestDatabase(testMetadata, connection);
                        });

                        afterEach(async () => {
                            connection && await connection.close();
                        });

                        it('applies a valid flat config to the generated files', async () => {
                            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-lint-ok-'));

                            const requireFromRepo = createRequire(path.join(process.cwd(), 'package.json'));
                            const stylisticUrl = pathToFileURL(requireFromRepo.resolve('@stylistic/eslint-plugin')).href;
                            const parserUrl = pathToFileURL(requireFromRepo.resolve('@typescript-eslint/parser')).href;

                            const configFile = path.join(tempDir, 'flat.config.mjs');
                            const configSource = [
                                `import stylistic from '${stylisticUrl}';`,
                                `import parser from '${parserUrl}';`,
                                'export default [',
                                '    {',
                                '        files: [\'**/*.ts\', \'**/*.tsx\'],',
                                '        languageOptions: {',
                                '            parser,',
                                '            parserOptions: { ecmaVersion: 2019, sourceType: \'module\' },',
                                '        },',
                                '        plugins: { \'@stylistic\': stylistic },',
                                '        rules: { \'@stylistic/indent\': [\'error\', 2] },',
                                '    },',
                                '];',
                                '',
                            ].join('\n');
                            await fs.writeFile(configFile, configSource);

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: { indices: true },
                                output: {
                                    outDir: tempDir,
                                    clean: true,
                                },
                                lintOptions: { configFile, fix: true },
                            };

                            await buildModels(config);

                            const generated = await fs.readFile(path.join(tempDir, 'authors.ts'), 'utf8');

                            // The default linter emits tab indentation; the flat config here forces
                            // spaces, so applying it must strip every tab and leave space indentation.
                            expect(generated).not.toContain('\t');
                            expect(generated).toMatch(/\n {2}/);

                            await fs.rm(tempDir, { recursive: true, force: true });
                        });

                        it('fails fast on a legacy .eslintrc.json config', async () => {
                            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stg-lint-legacy-'));
                            const configFile = path.join(tempDir, '.eslintrc.json');
                            await fs.writeFile(configFile, JSON.stringify({ rules: {} }));

                            const config: IConfig = {
                                connection: sequelizeOptions,
                                metadata: { indices: true },
                                output: {
                                    outDir: tempDir,
                                    clean: true,
                                },
                                lintOptions: { configFile },
                            };

                            await expect(buildModels(config)).rejects.toThrow(ESLINT_MIGRATION_GUIDE_URL);

                            await fs.rm(tempDir, { recursive: true, force: true });
                        });
                    });
                }

            });
        });
    }
}
