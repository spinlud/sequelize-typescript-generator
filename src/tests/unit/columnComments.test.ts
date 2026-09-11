import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { sanitiseJsDocComment } from '../../builders/utils.js';
import { renderNativeModelFile } from '../../builders/NativeModelRenderer.js';
import { indexTablesByModelName } from '../../builders/nativeAttributes.js';
import { ModelBuilder } from '../../builders/ModelBuilder.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IConfig } from '../../config/index.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';

const dialect = new DialectSQLite();

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

const authors = buildTable('authors', [
    buildColumn({ name: 'author_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'full_name', type: 'varchar', sequelizeType: dataType('STRING'), comment: 'Full name of the author' }),
    buildColumn({ name: 'tricky', type: 'varchar', sequelizeType: dataType('STRING'), allowNull: true, comment: 'ends with */ oops' }),
    buildColumn({ name: 'blank', type: 'varchar', sequelizeType: dataType('STRING'), allowNull: true, comment: '   ' }),
]);

const tablesMetadata: ITablesMetadata = { authors };
const tablesByModel = indexTablesByModelName(tablesMetadata);

/**
 * SQLite dialect stub that returns fixed table metadata instead of querying a
 * live database, so the decorators output can be generated in a unit test.
 */
class StubDialect extends DialectSQLite {
    constructor(private readonly stubMetadata: ITablesMetadata) {
        super();
    }

    public async buildTablesMetadata(): Promise<ITablesMetadata> {
        return this.stubMetadata;
    }
}

const createTempDir = (): Promise<string> => fs.mkdtemp(path.join(os.tmpdir(), 'stg-comments-'));

describe('sanitiseJsDocComment', () => {
    it('neutralises an embedded comment terminator so it cannot close the block', () => {
        const sanitised = sanitiseJsDocComment('closes here */ and continues');

        expect(sanitised).not.toContain('*/');

        const block = `/** ${sanitised} */`;
        // A single terminator only: splitting on it yields the body plus an empty tail.
        expect(block.split('*/')).toHaveLength(2);
    });

    it('leaves a comment without a terminator unchanged', () => {
        expect(sanitiseJsDocComment('Full name of the author')).toBe('Full name of the author');
    });
});

describe('Native format column comments', () => {
    const rendered = renderNativeModelFile(authors, dialect, tablesByModel);

    it('emits a JSDoc leading comment on the declare attribute', () => {
        expect(rendered).toContain('/** Full name of the author */\n    declare full_name');
    });

    it('sanitises an embedded terminator in the JSDoc but keeps the runtime comment option intact', () => {
        expect(rendered).toContain('/** ends with * / oops */');
        expect(rendered).toContain('comment: "ends with */ oops"');
    });

    it('emits no JSDoc for a whitespace-only comment', () => {
        expect(rendered).toContain('declare blank: string | null;');
        expect(rendered).not.toMatch(/\/\*\*[^\n]*\n\s*declare blank/);
    });
});

describe('Decorators format column comments', () => {
    let generated = '';

    beforeAll(async () => {
        const outDir = await createTempDir();
        const config: IConfig = {
            connection: { dialect: 'sqlite' },
            output: { outDir, clean: false },
            format: 'decorators',
            strict: true,
        };

        try {
            const builder = new ModelBuilder(config, new StubDialect(tablesMetadata));
            await builder.build();
            generated = await fs.readFile(path.join(outDir, 'authors.ts'), 'utf8');
        }
        finally {
            await fs.rm(outDir, { recursive: true, force: true });
        }
    });

    it('emits the JSDoc on both the class property and the Attributes interface', () => {
        const occurrences = generated.match(/\/\*\* Full name of the author \*\//g) ?? [];
        expect(occurrences).toHaveLength(2);
    });

    it('emits no JSDoc for a whitespace-only comment', () => {
        expect(generated).not.toContain('/**    */');
    });
});
