import path from 'path';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../connection';
import { buildSequelizeOptions } from '../environment';
import { IConfig, DialectMySQL, ModelBuilder } from '../../index';
import {
    dataTypesTableName,
    dataTypesTableDROP,
    dataTypesTableCREATE,
} from '../queries';

/**
 * Initialize test tables
 * @param {Sequelize} connection
 * @returns {Promise<void>}
 */
const initTestTables = async (connection: Sequelize): Promise<void> => {
    // Drop test tables
    await connection.query(dataTypesTableDROP);

    // Create test tables
    await connection.query(dataTypesTableCREATE);
};

const numericTests: [string, number][] = [
    ['bigint', 100000000000000000],
    ['smallint', 32767],
    ['mediumint', 8388607],
    ['tinyint', 127],
    ['decimal', 99.999],
    ['float', 66.78],
    ['double', 11.2345],
    ['int', 2147483647],
];

const stringTests: [string, string][] = [
    ['varchar', 'Hello world'],
    ['char', 'a'],
    ['tinytext', 'xyz'],
    ['mediumtext', 'Voodoo Lady'],
    ['longtext', 'Supercalifragilisticexpialidocious'],
    ['text', 'Access denied'],
];

const dateTests: [string, string | number | Date][] = [
    ['date', '2020-01-01'],
    ['time', '23:59:59'],
    ['datetime', new Date()],
    ['timestamp', new Date()],
    ['year', new Date().getFullYear()],
]

const binaryTests: [string, Buffer][] = [
    // ['bit', 1],
];

describe('MySQL', () => {
    const outDir = path.join(process.cwd(), 'output-models');
    let connection: Sequelize | undefined;
    let sequelizeOptions = buildSequelizeOptions('mysql');

    beforeAll(async () => {
        connection = createConnection({ ...sequelizeOptions });

        await connection.authenticate();

        await initTestTables(connection);
    });

    describe('Build', () => {
        it('should build models', async () => {
            const config: IConfig = {
                connection: sequelizeOptions,
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            const dialect = new DialectMySQL();
            const builder = new ModelBuilder(config, dialect);
            await builder.build();
        });

        it('should register models',() => {
            connection!.addModels([ outDir ]);
            const DataTypes = connection!.model(dataTypesTableName);

            expect(DataTypes).toBeDefined();
            expect(connection!.isDefined(dataTypesTableName)).toBe(true);
        });
    });

    describe('Data Types', () => {
        beforeAll(async () => {
            await initTestTables(connection!);
        });

        // Numeric and string tests
        for (const [testName, testValue] of [...numericTests, ...stringTests, ...dateTests]) {
            it(testName, async () => {
                const DataTypes = connection!.model(dataTypesTableName);
                const field = `f_${testName}`;
                const res = await DataTypes.upsert({ [field]: testValue });

                expect(res).toBe(true);

                const rows = await DataTypes.findAll({ order: [['id', 'DESC']], limit: 1, raw: true });
                expect(rows.length).toBe(1);
                expect(rows[0]).toHaveProperty(field, testValue);
            });
        }

    });

    afterAll(async () => {
        connection && await connection.close();
    });
});
