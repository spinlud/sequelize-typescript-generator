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
        beforeEach(async () => {
            await initTestTables(connection!);
        });

        it('bigint', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_bigint: 100000000000000000 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });

        it('smallint', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_smallint: 32767 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });

        it('mediumint', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_mediumint: 8388607 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });

        it('int', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_int: 2147483647 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });

        it('float', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_float: 11.22 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });

        it('double', async () => {
            const DataTypes = connection!.model(dataTypesTableName);
            const res = await DataTypes.upsert({ f_double: 33.44 });

            expect(res).toBe(true);

            const row = await DataTypes.findOne();
            expect(row).toBeDefined();
        });
    });

    afterAll(async () => {
        connection && await connection.close();
    });
});
