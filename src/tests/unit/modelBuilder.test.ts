import path from 'path';
import * as ts from 'typescript';
import { jest } from '@jest/globals';
import os from 'os';
import { promises as fs } from 'fs';
import { ModelBuilder } from '../../builders/ModelBuilder.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IConfig } from '../../config/index.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';
import type { Format } from '../../config/format.js';
import { compileGeneratedModels } from '../integration/compileGeneratedModels.js';

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

const UNMAPPED_DB_TYPE = 'plan_tier';

/**
 * SQLite dialect stub that additionally has no TypeScript type mapping for
 * `UNMAPPED_DB_TYPE`, as a dialect does for a database type it does not know.
 */
class UnmappedTypeStubDialect extends StubDialect {
    public mapDbTypeToJs(dbType: string): string | undefined {
        return dbType === UNMAPPED_DB_TYPE ? undefined : super.mapDbTypeToJs(dbType);
    }
}

const profiles = buildTable('profiles', [
    buildColumn({ name: 'profile_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'tier', type: UNMAPPED_DB_TYPE }),
], { schema: 'public' });

// Same column with a Sequelize data type, so the native `Model.init` options are complete
const profilesWithDataType = buildTable('profiles', [
    buildColumn({ name: 'profile_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'tier', type: UNMAPPED_DB_TYPE, sequelizeType: dataType('STRING') }),
], { schema: 'public' });

const UNMAPPED_WARNING_PREFIX = `[WARNING] Unmapped type '${UNMAPPED_DB_TYPE}' for column public.profiles.tier`;
const TYPE_OVERRIDES_HINT = 'Declare a type override with --type-overrides-file to set its type.';

/**
 * Create a scratch output directory inside the project, so the generated
 * models resolve the project's `sequelize` dependencies when type-checked.
 * @returns {Promise<string>}
 */
const createProjectTempDir = async (): Promise<string> => {
    const parent = path.join(process.cwd(), 'tmp');
    await fs.mkdir(parent, { recursive: true });

    return fs.mkdtemp(path.join(parent, 'stg-unmapped-'));
};

/**
 * Build the given `profiles` table in the given format, capturing the warnings.
 * @param {Format} format
 * @param {ITableMetadata} table
 * @returns {Promise<{ outDir: string, content: string, warnings: string[] }>}
 */
const buildUnmappedTypeModel = async (
    format: Format,
    table: ITableMetadata = profiles
): Promise<{ outDir: string, content: string, warnings: string[] }> => {
    const outDir = await createProjectTempDir();
    const warnings: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        warnings.push(args.map(arg => String(arg)).join(' '));
    });

    try {
        const builder = new ModelBuilder(buildConfig(outDir, format), new UnmappedTypeStubDialect({ profiles: table }));
        await builder.build();
    }
    finally {
        warnSpy.mockRestore();
    }

    const content = await fs.readFile(path.join(outDir, 'profiles.ts'), 'utf8');

    return { outDir, content, warnings };
};

describe('ModelBuilder.build unmapped types', () => {
    it('types an unmapped column as unknown in the native format and warns naming the column', async () => {
        const { outDir, content, warnings } = await buildUnmappedTypeModel('native');

        try {
            expect(content).toContain('declare tier: unknown;');
            expect(warnings).toContain(`${UNMAPPED_WARNING_PREFIX}: typed as 'unknown'. ${TYPE_OVERRIDES_HINT}`);
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('emits native output that strict-type-checks for a column typed as unknown', async () => {
        const { outDir, content, warnings } = await buildUnmappedTypeModel('native', profilesWithDataType);

        try {
            expect(content).toContain('declare tier: unknown;');
            expect(warnings).toContain(`${UNMAPPED_WARNING_PREFIX}: typed as 'unknown'. ${TYPE_OVERRIDES_HINT}`);

            const diagnostics = await compileGeneratedModels(outDir, 'native');
            expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual([]);
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('keeps an unmapped column typed as any in the decorators format and warns naming the column', async () => {
        const { outDir, content, warnings } = await buildUnmappedTypeModel('decorators');

        try {
            expect(content).toMatch(/tier!?: any;/);
            expect(warnings).toContain(`${UNMAPPED_WARNING_PREFIX}: typed as 'any'. ${TYPE_OVERRIDES_HINT}`);
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('does not warn about mapped columns', async () => {
        const { outDir, warnings } = await buildUnmappedTypeModel('native');

        try {
            expect(warnings.filter(warning => warning.includes('Unmapped type'))).toHaveLength(1);
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });
});
