import path from 'path';
import { promises as fs } from 'fs';
import { Sequelize } from 'sequelize-typescript';
import { createConnection } from '../../connection';
import { buildSequelizeOptions } from '../environment';
import { IConfig, DialectMySQL, ModelBuilder } from '../../index';
import {
    orderItemsTable,
    orderItemsTableQuery,
    ordersTable,
    ordersTableQuery,
} from '../queries';

describe('MySQL', () => {
    const outDir = path.join(process.cwd(), 'output-models');
    let connection: Sequelize | undefined;
    let sequelizeOptions = buildSequelizeOptions('mysql');

    beforeAll(async () => {
        connection = createConnection({ ...sequelizeOptions });

        await connection.authenticate();

        // Drop test tables
        await connection.query(`DROP TABLE IF EXISTS ${ordersTable}`);
        await connection.query(`DROP TABLE IF EXISTS ${orderItemsTable}`);

        // Create test tables
        await connection.query(ordersTableQuery);
        await connection.query(orderItemsTableQuery);
    });

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
        expect(connection!.isDefined(ordersTable)).toBe(true);
        expect(connection!.isDefined(orderItemsTable)).toBe(true);
    });

    it('should populate models', async () => {
        const Order = connection!.model(ordersTable);
        const OrderItem = connection!.model(orderItemsTable);

        await Order.upsert({
            order_public_id: 'abcd',
            opened_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            accountable: true,
            is_renew: false,
            deleted: false,
        });

        await OrderItem.upsert({
            order_item_public_id: 'efgh',
            order_id: 1,
            asset_variant_id: 1,
            ordered_at: new Date().toISOString(),
            quantity: 1,
            bundle_price: 10.0,
            bundle_size: 1,
            has_limited_lifecycle: false,
            lifecycle_units: 1,
            lifecycle_unit: 'year',
            discount_id: 1,
            tax_applies: true,
            tax_percent: 23.0,
            deleted: false,
        });
    });

    it('should fetch models', async () => {
        const Order = connection!.model(ordersTable);
        const OrderItem = connection!.model(orderItemsTable);

        const orders = await Order.findAll();
        const orderItems = await OrderItem.findAll();

        expect(orders.length).toBe(1);
        expect(orderItems.length).toBe(1);
    });

    afterAll(async () => {
        connection && await connection.close();
    });
});
