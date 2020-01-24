import path from 'path';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../../connection';
import { buildSequelizeOptions } from '../../environment';
import {DialectMySQL, IConfig, ModelBuilder} from '../../../index';
import { Case, Cases } from '../../../config/IConfig';
import {dataTypesTableNAME} from "../mysql/queries";

describe('MySQL', () => {
    const outDir = path.join(process.cwd(), 'output-models');
    let sequelizeOptions = buildSequelizeOptions('postgres');
    console.log(sequelizeOptions);

    describe('Build', () => {
        let connection: Sequelize | undefined;

        beforeAll(async () => {
            connection = createConnection({ ...sequelizeOptions });
            await connection.authenticate();
            // await initTestTables(connection);
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
