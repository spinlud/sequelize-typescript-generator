import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { jest } from '@jest/globals';
import * as ts from 'typescript';
import pluralize from 'pluralize';
import { ITestMetadata } from './ITestMetadata.js';
import { Sequelize } from 'sequelize-typescript';
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
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();
                };

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

                        const models = await import(indexDir);

                        // @ts-ignore
                        connection!.addModels([ ...Object.values(models) ]);

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
                        const diagnostics = await compileGeneratedModels(outDir);

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
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);
                        await fs.unlink(indexDir);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('should add only the provided tables', () => {
                        connection!.addModels([ outDir ]);

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
                                outDir: outDir,
                                clean: true,
                            }
                        };

                        await buildModels(config);
                        await fs.unlink(indexDir);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('should skip the provided tables', () => {
                        connection!.addModels([ outDir ]);

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
                                    outDir: outDir,
                                    clean: true,
                                }
                            };

                            await buildModels(config);
                            await fs.unlink(indexDir);
                        });

                        afterAll(async () => {
                            connection && await connection.close();
                        });

                        it('should skip views', () => {
                            connection!.addModels([ outDir ]);

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

                        const models = await import(indexDir);

                        // @ts-ignore
                        connection!.addModels([ ...Object.values(models) ]);
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
                        else if (receivedValueType === 'object' &&
                            sequelizeOptions.dialect === 'mariadb' &&
                            typeName === 'json'
                        ) {
                            expect(JSON.stringify(receivedValue)).toStrictEqual(typeValue);
                        }
                        else {
                            expect(receivedValueType).toStrictEqual(expectedValueType);
                        }
                        // @ts-ignore-end
                    });
                });

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

                        const models = await import(indexDir);

                        // @ts-ignore
                        connection!.addModels([ ...Object.values(models) ]);
                    });

                    afterAll(async () => {
                        connection && await connection.close();
                    });

                    it('1:1', async () => {
                        const personModel = connection!.model(testMetadata.associations.leftTableOneToOne);
                        const passportModel = connection!.model(testMetadata.associations.rightTableOneToOne);
                        const personField = pluralize.singular(testMetadata.associations.leftTableOneToOne);
                        const passportField = pluralize.singular(testMetadata.associations.rightTableOneToOne);

                        const personRows = (await personModel.findAll({  include: [ passportModel ] }))
                            .map(e => e.toJSON());

                        for (const person of personRows) {
                            expect(person).toHaveProperty(passportField);
                            expect(person[passportField]).toBeDefined();
                            expect(Array.isArray(person[passportField])).toBeFalsy();
                        }

                        const passportRows = (await passportModel.findAll({  include: [ personModel ] }))
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

                        const racesRows = (await racesModel.findAll({  include: [ unitsModel ] }))
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

                        const unitsRows = (await unitsModel.findAll({  include: [ racesModel ] }))
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

                        const authorsRows = (await authorsModel.findAll({  include: [ booksModel ] }))
                            .map(e => e.toJSON());

                        for (const author of authorsRows) {
                            expect(author).toHaveProperty(booksField);
                            expect(Array.isArray(author[booksField])).toBe(true);
                            expect(author[booksField].length).toBeGreaterThanOrEqual(1);
                        }

                        const booksRows = (await booksModel.findAll({  include: [ authorsModel ] }))
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
                            expect(tablesMetadata['units'].columns['race_id'].foreignKey).toMatchObject({
                                name: 'race_id',
                                targetModel: 'races',
                                targetKey: 'race_id',
                                constraintName: expect.any(String),
                                onDelete: 'CASCADE',
                                onUpdate: 'RESTRICT',
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
