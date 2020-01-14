import {createSequelize} from "./connection";
import { QueryTypes } from 'sequelize';

interface IColumnMetadata {
    TABLE_CATALOG: string;
    TABLE_SCHEMA: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    ORDINAL_POSITION?: number;
    COLUMN_DEFAULT?: string;
    IS_NULLABLE?: string;
    DATA_TYPE: string;
    CHARACTER_MAXIMUM_LENGTH?: string;
    CHARACTER_OCTET_LENGTH?: string;
    NUMERIC_PRECISION?: number;
    NUMERIC_SCALE?: number;
    DATETIME_PRECISION?: string;
    CHARACTER_SET_NAME?: string;
    COLLATION_NAME?: string;
    COLUMN_TYPE?: string;
    COLUMN_KEY?: string;
    EXTRA?: string;
    PRIVILEGES?: string;
    COLUMN_COMMENT?: string;
    GENERATION_EXPRESSION?: string;
}

// export type Dialect =  'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'mariadb';

(async () => {
    const sequelize = createSequelize({
        dialect: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'administration',
        username: 'root',
        ssl: true,
        logging: false,
    });

    await sequelize.authenticate();

    const schemaName = 'administration';
    const tableName = 'transactions';

    const columnsMetadata: IColumnMetadata[] = (await sequelize.query(`
        SELECT *
        FROM information_schema.columns
        WHERE (table_schema='${schemaName}' and table_name = '${tableName}')
        order by ordinal_position;
    `, {
        raw: true,
        type: QueryTypes.SELECT
    })) as IColumnMetadata[];

    columnsMetadata.forEach(e => {
        console.log(e.COLUMN_NAME, e.COLUMN_TYPE, e.EXTRA);
    })

    await sequelize.close();
})();
