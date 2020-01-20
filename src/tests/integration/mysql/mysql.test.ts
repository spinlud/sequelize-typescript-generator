import path from 'path';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../../connection';
import { buildSequelizeOptions } from '../../environment';
import { IConfig, DialectMySQL, ModelBuilder } from '../../../index';
import * as geometries from './geometries';
import {
    dataTypesTableName,
    dataTypesTableDROP,
    dataTypesTableCREATE,
} from './queries';


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
];

const collectionsTests: [string, string][] = [
    ['enum', 'BB'],
    ['set', 'X'],
];

const binaryStringsTests: [string, Buffer][] = [
    ['binary', Buffer.from('A')],
    ['blob', Buffer.from('Not authorized')],
    ['tinyblob', Buffer.from('xyz')],
    ['mediumblob', Buffer.from('Voodoo Lady')],
    ['longblob', Buffer.from('Supercalifragilisticexpialidocious')],
];

const geometriesTests: [string, Object][] = [
    ['point', geometries.Point],
    ['multipoint', geometries.MultiPoint],
    ['linestring', geometries.LineString],
    ['multilinestring', geometries.MultiLineString],
    ['polygon', geometries.Polygon],
    ['multipolygon', geometries.MultiPolygon],
    ['geometry', geometries.Geometry],
    ['geometrycollection', geometries.GeometryCollection],
];

const jsonTests: [string, Object][] = [
    ['json', JSON.parse('{"key1": "value1", "key2": "value2"}')],
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

        // BIT (mysql2 driver returns bit field as a Uint8Array)
        it('bit', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const testField = `f_bit`;
            const testValue = 127;
            const res = await DataTypes.upsert({ [testField]: testValue });

            expect(res).toBe(true);

            const rows = await DataTypes.findAll({ order: [['id', 'DESC']], limit: 1, /* raw: true */ });
            expect(rows.length).toBe(1);

            // @ts-ignore-start
            const receivedValue: Uint8Array = rows[0][testField];
            expect(receivedValue).toBeDefined();
            const bufferToNumber: number = Buffer.from(receivedValue).readUIntBE(0, receivedValue.length);
            expect(bufferToNumber).toStrictEqual(testValue);
            // @ts-ignore-end
        });

        for (const [testName, testValue] of [
            ...numericTests,
            ...stringTests,
            ...dateTests,
            ...collectionsTests,
            ...binaryStringsTests,
            ...geometriesTests,
            ...jsonTests,
        ]) {
            it(testName, async () => {
                const DataTypes = connection!.model(dataTypesTableName);
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

    afterAll(async () => {
        connection && await connection.close();
    });
});
