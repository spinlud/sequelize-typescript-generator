import path from 'path';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../../connection';
import { buildSequelizeOptions } from '../../environment';
import { IConfig, DialectPostgres, ModelBuilder} from '../../../index';
import { Case, Cases } from '../../../config/IConfig';
import {
    SCHEMA_NAME,
    SCHEMA_DROP,
    SCHEMA_CREATE,
    DATA_TYPES_TABLE_NAME,
    DATA_TYPES_TABLE_DROP,
    DATA_TYPES_TABLE_CREATE,
} from "./queries";

/**
 * Initialize test database
 * @param {Sequelize} connection
 * @returns {Promise<void>}
 */
const initTestDb = async (connection: Sequelize): Promise<void> => {
    await connection.query(SCHEMA_DROP);
    await connection.query(SCHEMA_CREATE);

    await connection.query(DATA_TYPES_TABLE_CREATE);
}

describe('MySQL', () => {
    const outDir = path.join(process.cwd(), 'output-models');
    let sequelizeOptions = buildSequelizeOptions('postgres');
    console.log(sequelizeOptions);

    describe('Build', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            await initTestDb(connection);

            await connection.createSchema(SCHEMA_NAME, {});
        });

        afterAll(async () => {
            connection && await connection.close();
        });

        it('should build models', async () => {
            const config: IConfig = {
                connection: sequelizeOptions,
                output: {
                    outDir: outDir,
                    clean: true,
                }
            };

            // const dialect = new DialectMySQL();
            // const builder = new ModelBuilder(config, dialect);
            // await builder.build();
        });

        // it('should register models',() => {
        //     connection!.addModels([ outDir ]);
        //     connection!.model(dataTypesTableNAME);
        //
        //     expect(connection!.isDefined(dataTypesTableNAME)).toBe(true);
        // });
    });

});
