import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { ModelBuilder } from '../../builders/ModelBuilder.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IConfig } from '../../config/index.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';

const dataType = (key: ISequelizeDataType['key'], ...args: ISequelizeDataType['args']): ISequelizeDataType => ({ key, args });

const buildColumn = (
    overrides: Partial<IColumnMetadata> & Pick<IColumnMetadata, 'name' | 'type' | 'sequelizeType'>
): IColumnMetadata => ({
    originName: overrides.name,
    typeExt: overrides.type,
    primaryKey: false,
    allowNull: false,
    autoIncrement: false,
    ...overrides,
});

const buildTable = (
    name: string,
    columns: IColumnMetadata[],
    overrides: Partial<ITableMetadata> = {}
): ITableMetadata => ({
    name,
    originName: name,
    timestamps: false,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    ...overrides,
});

const races = buildTable('races', [
    buildColumn({ name: 'race_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'race_name', type: 'varchar', sequelizeType: dataType('STRING') }),
], {
    associations: [
        { associationName: 'HasMany', targetModel: 'units', alias: 'units', foreignKey: 'race_id', sourceKey: 'race_id' },
    ],
});

const units = buildTable('units', [
    buildColumn({ name: 'unit_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'unit_name', type: 'varchar', sequelizeType: dataType('STRING') }),
    buildColumn({
        name: 'race_id',
        type: 'integer',
        sequelizeType: dataType('INTEGER'),
        foreignKey: { name: 'race_id', targetModel: 'races', targetKey: 'race_id' },
    }),
], {
    associations: [
        { associationName: 'BelongsTo', targetModel: 'races', alias: 'race' },
    ],
});

const tablesMetadata: ITablesMetadata = { races, units };

/**
 * SQLite dialect stub that returns fixed table metadata instead of querying a
 * live database, so `build()` can be exercised end to end in a unit test.
 */
class StubDialect extends DialectSQLite {
    constructor(private readonly stubMetadata: ITablesMetadata) {
        super();
    }

    public async buildTablesMetadata(): Promise<ITablesMetadata> {
        return this.stubMetadata;
    }
}

const buildConfig = (outDir: string, format: IConfig['format']): IConfig => ({
    connection: { dialect: 'sqlite' },
    output: { outDir, clean: false },
    ...format && { format },
});

const createTempDir = (): Promise<string> => fs.mkdtemp(path.join(os.tmpdir(), 'stg-build-'));

describe('ModelBuilder.build dispatch', () => {
    it('renders native output for format "native"', async () => {
        const outDir = await createTempDir();
        const dialect = new StubDialect(tablesMetadata);

        try {
            const builder = new ModelBuilder(buildConfig(outDir, 'native'), dialect);
            await builder.build();

            const files = (await fs.readdir(outDir)).sort();
            expect(files).toEqual(['index.ts', 'initModels.ts', 'races.ts', 'units.ts']);

            const unitsContent = await fs.readFile(path.join(outDir, 'units.ts'), 'utf8');
            expect(unitsContent).toContain('InferAttributes');
            expect(unitsContent).toContain('static initModel');
            expect(unitsContent).not.toContain('@Table');

            const wiringContent = await fs.readFile(path.join(outDir, 'initModels.ts'), 'utf8');
            expect(wiringContent).toContain('export function initModels');
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('renders decorators output for format "decorators"', async () => {
        const outDir = await createTempDir();
        const dialect = new StubDialect(tablesMetadata);

        try {
            const builder = new ModelBuilder(buildConfig(outDir, 'decorators'), dialect);
            await builder.build();

            const files = (await fs.readdir(outDir)).sort();
            expect(files).toEqual(['index.ts', 'races.ts', 'units.ts']);

            const unitsContent = await fs.readFile(path.join(outDir, 'units.ts'), 'utf8');
            expect(unitsContent).toContain('sequelize-typescript');
            expect(unitsContent).toContain('@Table');
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('emits nothing and warns when there are no tables', async () => {
        const outDir = await createTempDir();
        const dialect = new StubDialect({});
        const originalWarn = console.warn;
        let warnCount = 0;
        console.warn = (): void => { warnCount += 1; };

        try {
            const builder = new ModelBuilder(buildConfig(outDir, 'native'), dialect);
            await builder.build();

            expect(await fs.readdir(outDir)).toEqual([]);
            expect(warnCount).toBeGreaterThan(0);
        }
        finally {
            console.warn = originalWarn;
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });
});
