import path from 'path';
import { promises as fs } from 'fs';
import pluralize from 'pluralize';
import { ITestMetadata } from './ITestMetadata';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { buildSequelizeOptions } from '../environment';
import { createConnection } from '../../connection';
import { IConfig } from '../../config';
import { Dialect } from '../../dialects/Dialect';
import { getTransformer } from '../../dialects/utils';
import { ModelBuilder } from '../../builders';
import { TransformCases, TransformTarget, TransformFn } from '../../config/IConfig';
import {
    DialectMySQL,
    DialectPostgres,
    DialectMSSQL,
    DialectMariaDB,
    DialectSQLite,
} from '../../dialects';

/**
 * Workaround: deprecated GeomFromText function for MySQL
 */
const applyGeomFromTextWorkaroundMySQL = (): void => { // Reference: https://github.com/sequelize/sequelize/issues/9786
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
        const { createQueries, insertQueries, dropQuery } = testTable;
        await connection.query(dropQuery);

        for (const createQuery of createQueries) {
            await connection.query(createQuery);
        }

        if (insertQueries) {
            for (const insertQuery of insertQueries) {
                await connection.query(insertQuery);
            }
        }
    }

    if (testMetadata.testViews) {
        for (const testView of testMetadata.testViews) {
            const { createQueries, dropQuery } = testView;
            await connection.query(dropQuery);

            for (const createQuery of createQueries) {
                await connection.query(createQuery);
            }
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
        case 'mariadb':
            return new DialectMariaDB();
        case 'sqlite':
            return new DialectSQLite();
        default:
            throw new Error(`Invalid dialect ${testMetadata.dialect}`);
    }
};

export class TestRunner {
    constructor(private testMetadata: ITestMetadata) {}

    public run(): void {
        const testMetadata = this.testMetadata;

        describe(testMetadata.name, () => {
            jest.setTimeout(120000);
            const outDir = path.join(process.cwd(), 'src/tests/integration/output-models');
            const indexDir = path.join(outDir, 'index.ts');
            const associationsFilePath = path.join(process.cwd(), 'src', 'tests', 'integration', 'associations.csv');
            const sequelizeOptions = buildSequelizeOptions(testMetadata.dialect);

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
                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();

                    const models = await import(path.join(outDir, 'index.ts'));

                    // @ts-ignore
                    connection!.addModels([ ...Object.values(models) ]);

                    for (const testTable of testTables) {
                        connection!.model(testTable.name);
                        expect(connection!.isDefined(testTable.name)).toBe(true);
                    }
                };

                beforeEach(async () => {
                    connection = createConnection({ ...sequelizeOptions });
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

            describe('Tables', () => {
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
                        connection = createConnection({ ...sequelizeOptions });
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

                        const dialect = buildDialect(testMetadata);
                        const builder = new ModelBuilder(config, dialect);
                        await builder.build();
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
                    connection = createConnection({ ...sequelizeOptions });
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

                        const dialect = buildDialect(testMetadata);
                        const builder = new ModelBuilder(config, dialect);
                        await builder.build();

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

                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();

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

                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();

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

                    const models = await import(indexDir);

                    // @ts-ignore
                    connection!.addModels([ ...Object.values(models) ]);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                it.each(testMetadata.dataTypes.testValues)('%s', async (typeName, typeValue) => {
                    const dialect = buildDialect(testMetadata);
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
                    connection = createConnection({ ...sequelizeOptions });
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

                    const dialect = buildDialect(testMetadata);
                    const builder = new ModelBuilder(config, dialect);
                    await builder.build();

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

        });
    }
}
