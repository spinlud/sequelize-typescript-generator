import path from 'path';
import { promises as fs } from 'fs';
import pluralize from 'pluralize';
import { ITestMetadata } from './ITestMetadata';
import { ModelCtor, Model, Sequelize } from 'sequelize-typescript';
import { buildSequelizeOptions } from '../environment';
import { createConnection } from '../../connection';
import { IConfig } from '../../config';
import { Dialect, ITableName } from '../../dialects/Dialect';
import { Dictionary, getTransformer, populateFullTableNameDictionary } from '../../dialects/utils';
import { ModelBuilder } from '../../builders';
import { TransformCases, TransformTarget, TransformFn } from '../../config/IConfig';
import {
    DialectMySQL,
    DialectPostgres,
    DialectMSSQL,
    DialectMariaDB,
    DialectSQLite,
} from '../../dialects';
import { AssociationsParser, AssociationType, IAssociationsParsed } from '../../dialects/AssociationsParser';
import { getAssociationCustomPropName } from './test-helpers';

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
            const outDir = path.join(process.cwd(), this.testMetadata.dialect.toString(), 'output-models');
            const indexFile = path.join(outDir, 'index.ts');
            const associationsFilePath = path.join(process.cwd(), 'src', 'tests', 'integration', 'associations.csv');
            const sequelizeOptions = buildSequelizeOptions(testMetadata.dialect);

            describe('Build', () => {
                const { testTables } = testMetadata;
                let connection: Sequelize | undefined;

                const config: IConfig = {
                    connection: {
                        ...sequelizeOptions,
                        ...{
                            logging: (sql: string, timing?: number) => {const r = 1},
                            logQueryParameters: false
                        }
                    },
                    metadata: {
                        ...testMetadata.schema && { schema: testMetadata.schema.name }, // Postgres
                        indices: true,
                        associationsFile: associationsFilePath,
                        // case: 'LOWER'
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

                    try {
                        const models = await import(path.join(outDir, 'index.ts'));
    
                        // @ts-ignore
                        connection!.addModels([ ...Object.values(models) ]);
                    } catch (er) {
                        console.error('Error importing the models.', er)
                    }

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
                    await fs.unlink(indexFile);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                it('should add only the provided tables', () => {
                    connection!.addModels([ outDir ]);

                    const includedTableNames = filterTables.map(t => t.name);
                    for (const tableName of includedTableNames) {
                        connection!.model(tableName);
                        expect(connection!.isDefined(tableName)).toBe(true);
                    }

                    const notIncludedTableNames = testTables.map(t => t.name).filter(n => !includedTableNames.includes(n));
                    for (const tableName of notIncludedTableNames) {
                        expect(() => connection!.model(tableName)).toThrow();
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
                    await fs.unlink(indexFile);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                it('should skip the provided tables', () => {
                    connection!.addModels([ outDir ]);

                    const skippedTableNames = filterSkipTables.map(t => t.name);
                    for (const tableName of skippedTableNames) {
                        expect(() => connection!.model(tableName)).toThrow();
                    }

                    const notSkippedTables = testTables.map(t => t.name).filter(n => !skippedTableNames.includes(n));
                    for (const tableName of notSkippedTables) {
                        connection!.model(tableName);
                        expect(connection!.isDefined(tableName)).toBe(true);
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
                        await fs.unlink(indexFile);
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

                    const models = await import(indexFile);

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
                let parsedAssociations: IAssociationsParsed | undefined;
                const tableNameDictionary: Dictionary<ITableName> = {};

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

                    const models = await import(indexFile);

                    // @ts-ignore
                    connection!.addModels([ ...Object.values(models) ]);

                    const allTables = await dialect.fetchTables(connection, config);
                    populateFullTableNameDictionary(allTables, tableNameDictionary);
                    parsedAssociations = AssociationsParser.parse(tableNameDictionary, associationsFilePath);
                });

                afterAll(async () => {
                    connection && await connection.close();
                });

                describe('Basic', () => {
                    it('1:1', async () => {
                        const personModel = connection!.model(testMetadata.associations.oneToOne.leftTable);
                        const passportModel = connection!.model(testMetadata.associations.oneToOne.rightTable);
                        const personField = pluralize.singular(testMetadata.associations.oneToOne.leftTable);
                        const passportField = pluralize.singular(testMetadata.associations.oneToOne.rightTable);

                        const people = await personModel.findAll({  include: [ passportModel ] });

                        for (const person of people) {
                            expect(person).toHaveProperty(passportField);
                        }

                        const passports = await passportModel.findAll({  include: [ personModel ] });

                        for (const pass of passports) {
                            expect(pass).toHaveProperty(personField);
                        }
                    });

                    it('1:N', async () => {
                        const racesModel = connection!.model(testMetadata.associations.oneToMany.leftTable);
                        const unitsModel = connection!.model(testMetadata.associations.oneToMany.rightTable);
                        const raceField = pluralize.singular(testMetadata.associations.oneToMany.leftTable);
                        const unitsField = pluralize.plural(testMetadata.associations.oneToMany.rightTable);

                        const races = await racesModel.findAll({  include: [ unitsModel ] });

                        for (const race of races) {
                            expect(race).toHaveProperty(unitsField);

                            // @ts-ignore
                            const associatedUnits = race[unitsField];

                            expect(associatedUnits).toHaveProperty('length');
                            expect(associatedUnits.length).toBeGreaterThanOrEqual(1);
                        }

                        const units = await unitsModel.findAll({  include: [ racesModel ] });

                        for (const unit of units) {
                            expect(unit).toHaveProperty(raceField);
                        }
                    });

                    it('N:N', async () => {
                        const authorsModel = connection!.model(testMetadata.associations.manyToMany.leftTable);
                        const booksModel = connection!.model(testMetadata.associations.manyToMany.rightTable);
                        const authorsField = pluralize.plural(testMetadata.associations.manyToMany.leftTable);
                        const booksField = pluralize.plural(testMetadata.associations.manyToMany.rightTable);

                        const authors = await authorsModel.findAll({  include: [ booksModel ] });

                        for (const author of authors) {
                            expect(author).toHaveProperty(booksField);

                            // @ts-ignore
                            const associatedBooks = author[booksField];

                            expect(associatedBooks).toHaveProperty('length');
                            expect(associatedBooks.length).toBeGreaterThanOrEqual(1);
                        }

                        const books = await booksModel.findAll({  include: [ authorsModel ] });

                        for (const book of books) {
                            expect(book).toHaveProperty(authorsField);

                            // @ts-ignore
                            const associatedAuthors = book[authorsField];

                            expect(associatedAuthors).toHaveProperty('length');
                            expect(associatedAuthors.length).toBeGreaterThanOrEqual(1);
                        }
                    });
                });

                if (!!testMetadata.associations.navProps) {
                    describe('Overriding Navigation Prop Names', () => {
                        if (!!testMetadata.associations.navProps?.oneToOne) {
                            it('1:1', async () => {
                                
                                const navProps = testMetadata.associations.navProps!.oneToOne;
                                const scholarshipTable = tableNameDictionary[navProps.leftTable.toLowerCase()];
                                const studentTable = tableNameDictionary[navProps.rightTable.toLowerCase()];
                                
                                await checkNavProps(connection, parsedAssociations!, scholarshipTable, studentTable, 'HasOne', 'BelongsTo');
                            });
                        }

                        if (!!testMetadata.associations.navProps?.oneToOne) {
                            it('1:N', async () => {
                                const navProps = testMetadata.associations.navProps!.oneToMany;
                                const codeLookupTable = tableNameDictionary[navProps.leftTable.toLowerCase()];
                                const horseTable = tableNameDictionary[navProps.rightTable.toLowerCase()];
                                const foreignKeys = navProps.rightKeys;

                                await checkNavProps(connection, parsedAssociations!, codeLookupTable, horseTable, 'HasMany', 'BelongsTo', foreignKeys);
                            });
                        }

                        it.skip('N:N', async () => {
                            const authorsModel = connection!.model(testMetadata.associations.manyToMany.leftTable);
                            const booksModel = connection!.model(testMetadata.associations.manyToMany.rightTable);
                            const authorsField = pluralize.plural(testMetadata.associations.manyToMany.leftTable);
                            const booksField = pluralize.plural(testMetadata.associations.manyToMany.rightTable);

                            const authors = await authorsModel.findAll({  include: [ booksModel ] });

                            for (const author of authors) {
                                expect(author).toHaveProperty(booksField);

                                // @ts-ignore
                                const associatedBooks = author[booksField];

                                expect(associatedBooks).toHaveProperty('length');
                                expect(associatedBooks.length).toBeGreaterThanOrEqual(1);
                            }

                            const books = await booksModel.findAll({  include: [ authorsModel ] });

                            for (const book of books) {
                                expect(book).toHaveProperty(authorsField);

                                // @ts-ignore
                                const associatedAuthors = book[authorsField];

                                expect(associatedAuthors).toHaveProperty('length');
                                expect(associatedAuthors.length).toBeGreaterThanOrEqual(1);
                            }
                        });
                    });
                }

            });

        });
    }
}
async function checkNavProps (
    connection: Sequelize | undefined,
    parsedAssociations: IAssociationsParsed,
    leftTable: ITableName,
    rightTable: ITableName,
    primaryAssociationType: AssociationType,
    foreignAssociationType: AssociationType,
    foreignKeys?: string[]
) {

    const leftModel = connection!.model(leftTable.name);      // like codeLookup
    const rightModel = connection!.model(rightTable.name);    // like horse

    const defaultFieldNameOnRightTable = pluralize.singular(leftTable.name);
    const defaultFieldNameOnLeftTable = pluralize.singular(rightTable.name);

    if (!foreignKeys || foreignKeys.length == 0) {
        foreignKeys = [''];
    }

    for (let i = 0; i < foreignKeys.length; i++) {
        const key = foreignKeys[i];
        
        await checkPropsOneDirection(parsedAssociations, rightTable, foreignAssociationType, leftTable, key, defaultFieldNameOnRightTable, rightModel, leftModel);
        await checkPropsOneDirection(parsedAssociations, leftTable, primaryAssociationType, rightTable, key, defaultFieldNameOnLeftTable, leftModel, rightModel);
    }
}

async function checkPropsOneDirection (
    parsedAssociations: IAssociationsParsed,
    table1: ITableName,
    associationType: AssociationType,
    table2: ITableName,
    key: string,
    defaultFieldNameOnTable1: string,
    model1: ModelCtor<Model<any, any>>,
    model2: ModelCtor<Model<any, any>>
) {
    const association = getAssociationCustomPropName(parsedAssociations, table1.fullTableName, associationType, table2.fullTableName, key);
    const customFieldNameOnTable1 = association?.targetModelPropName;
    const fieldNameOnTable1 = customFieldNameOnTable1 ?? defaultFieldNameOnTable1;

    const modelToInclude = association?.targetAlias ?? model2;

    const shouldHaveNavProp = !association?.hasMultipleForSameTarget || !!association?.targetAlias;

    // need an alias defined since there are multiple relationships between the same 2 tables, so this nav prop should not exist
    const findOpts = shouldHaveNavProp
        ? { include: [modelToInclude] }
        : {};

    const model1Records = await model1.findAll(findOpts);
    for (const model1Record of model1Records) {
        if (shouldHaveNavProp) {
            expect(model1Record).toHaveProperty(fieldNameOnTable1);
        } else {
            expect(model1Record).not.toHaveProperty(fieldNameOnTable1);
        }
        if (!!customFieldNameOnTable1 || !shouldHaveNavProp) {
            expect(model1Record).not.toHaveProperty(defaultFieldNameOnTable1);
        }
    }
}

