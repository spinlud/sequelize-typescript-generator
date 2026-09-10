import {
    AttributeKind,
    classifyAttribute,
    collectTableIndexes,
    indexTablesByModelName,
    INativeIndex,
    isCreationOptionalColumn,
    isParanoidColumn,
    isPrimaryKeyIndex,
    resolveForeignKeyTargetAttribute,
    resolvePrimaryKeyAttribute,
} from '../../builders/nativeAttributes.js';
import type { IColumnMetadata, ITableMetadata } from '../../dialects/Dialect.js';

const buildColumn = (overrides: Partial<IColumnMetadata> & Pick<IColumnMetadata, 'name'>): IColumnMetadata => ({
    originName: overrides.name,
    type: 'int',
    typeExt: 'int',
    primaryKey: false,
    allowNull: false,
    autoIncrement: false,
    ...overrides,
});

const buildTable = (columns: IColumnMetadata[], overrides: Partial<ITableMetadata> = {}): ITableMetadata => ({
    name: overrides.name ?? 'sample',
    originName: overrides.originName ?? overrides.name ?? 'sample',
    timestamps: false,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    ...overrides,
});

describe('nativeAttributes', () => {

    describe('isParanoidColumn', () => {
        it('is true only for the soft-delete column of a paranoid table', () => {
            const deletedAt = buildColumn({ name: 'deleted_at', allowNull: true });
            const other = buildColumn({ name: 'name' });
            const table = buildTable([deletedAt, other], { paranoid: true, deletedAt: 'deleted_at' });

            expect(isParanoidColumn(deletedAt, table)).toBe(true);
            expect(isParanoidColumn(other, table)).toBe(false);
        });

        it('is false when the table is not paranoid', () => {
            const deletedAt = buildColumn({ name: 'deleted_at', allowNull: true });
            const table = buildTable([deletedAt]);

            expect(isParanoidColumn(deletedAt, table)).toBe(false);
        });
    });

    describe('isCreationOptionalColumn', () => {
        it('is true for an auto-increment column', () => {
            const column = buildColumn({ name: 'id', primaryKey: true, autoIncrement: true });
            expect(isCreationOptionalColumn(column, buildTable([column]))).toBe(true);
        });

        it('is true for a column with a default value', () => {
            const column = buildColumn({ name: 'status', defaultValue: 'active' });
            expect(isCreationOptionalColumn(column, buildTable([column]))).toBe(true);
        });

        it('is true for a default value of zero', () => {
            const column = buildColumn({ name: 'counter', defaultValue: 0 });
            expect(isCreationOptionalColumn(column, buildTable([column]))).toBe(true);
        });

        it('is true for the soft-delete column', () => {
            const column = buildColumn({ name: 'deleted_at', allowNull: true });
            const table = buildTable([column], { paranoid: true, deletedAt: 'deleted_at' });
            expect(isCreationOptionalColumn(column, table)).toBe(true);
        });

        it('is false for a plain required column', () => {
            const column = buildColumn({ name: 'name' });
            expect(isCreationOptionalColumn(column, buildTable([column]))).toBe(false);
        });
    });

    describe('classifyAttribute', () => {
        const cases: Array<{ name: string; column: IColumnMetadata; table?: ITableMetadata; isForeignKeyTargetGenerated: boolean; expected: AttributeKind }> = [
            {
                name: 'an auto-increment primary key',
                column: buildColumn({ name: 'id', primaryKey: true, autoIncrement: true }),
                isForeignKeyTargetGenerated: false,
                expected: 'creationOptional',
            },
            {
                name: 'a plain required column',
                column: buildColumn({ name: 'name' }),
                isForeignKeyTargetGenerated: false,
                expected: 'plain',
            },
            {
                name: 'a nullable column without default',
                column: buildColumn({ name: 'nickname', allowNull: true }),
                isForeignKeyTargetGenerated: false,
                expected: 'nullable',
            },
            {
                name: 'a required column with a default',
                column: buildColumn({ name: 'status', defaultValue: 'active' }),
                isForeignKeyTargetGenerated: false,
                expected: 'creationOptional',
            },
            {
                name: 'a nullable column with a default',
                column: buildColumn({ name: 'flag', allowNull: true, defaultValue: 0 }),
                isForeignKeyTargetGenerated: false,
                expected: 'creationOptionalNullable',
            },
            {
                name: 'a required foreign key to a generated model',
                column: buildColumn({
                    name: 'race_id',
                    foreignKey: { name: 'race_id', targetModel: 'races', targetKey: 'race_id' },
                }),
                isForeignKeyTargetGenerated: true,
                expected: 'foreignKey',
            },
            {
                name: 'a nullable self-referential foreign key',
                column: buildColumn({
                    name: 'manager_id',
                    allowNull: true,
                    foreignKey: { name: 'manager_id', targetModel: 'employees', targetKey: 'employee_id' },
                }),
                isForeignKeyTargetGenerated: true,
                expected: 'foreignKeyNullable',
            },
            {
                name: 'a foreign key column whose target is not generated',
                column: buildColumn({
                    name: 'external_id',
                    foreignKey: { name: 'external_id', targetModel: 'external' },
                }),
                isForeignKeyTargetGenerated: false,
                expected: 'plain',
            },
        ];

        it.each(cases)('classifies $name', ({ column, table, isForeignKeyTargetGenerated, expected }) => {
            const resolvedTable = table ?? buildTable([column]);
            expect(classifyAttribute(column, resolvedTable, isForeignKeyTargetGenerated)).toBe(expected);
        });

        it('classifies the paranoid soft-delete column as creationOptionalNullable', () => {
            const column = buildColumn({ name: 'deleted_at', allowNull: true });
            const table = buildTable([column], { paranoid: true, deletedAt: 'deleted_at' });
            expect(classifyAttribute(column, table, false)).toBe('creationOptionalNullable');
        });
    });

    describe('resolvePrimaryKeyAttribute', () => {
        it('returns the single primary key attribute', () => {
            const table = buildTable([
                buildColumn({ name: 'id', primaryKey: true, autoIncrement: true }),
                buildColumn({ name: 'name' }),
            ]);
            expect(resolvePrimaryKeyAttribute(table)).toBe('id');
        });

        it('returns undefined for a composite primary key', () => {
            const table = buildTable([
                buildColumn({ name: 'author_id', primaryKey: true }),
                buildColumn({ name: 'book_id', primaryKey: true }),
            ]);
            expect(resolvePrimaryKeyAttribute(table)).toBeUndefined();
        });

        it('returns undefined when there is no primary key', () => {
            expect(resolvePrimaryKeyAttribute(buildTable([buildColumn({ name: 'name' })]))).toBeUndefined();
        });
    });

    describe('indexTablesByModelName', () => {
        it('keys tables by their model name', () => {
            const races = buildTable([buildColumn({ name: 'race_id', primaryKey: true })], { name: 'races', originName: 'races' });
            const units = buildTable([buildColumn({ name: 'unit_id', primaryKey: true })], { name: 'units', originName: 'units' });
            const byModel = indexTablesByModelName({ races, units });

            expect(byModel.get('races')).toBe(races);
            expect(byModel.get('units')).toBe(units);
            expect(byModel.has('missing')).toBe(false);
        });
    });

    describe('resolveForeignKeyTargetAttribute', () => {
        const races = buildTable([buildColumn({ name: 'race_id', primaryKey: true })], { name: 'races' });

        it('uses the explicit target key', () => {
            expect(resolveForeignKeyTargetAttribute(
                { name: 'race_id', targetModel: 'races', targetKey: 'race_id' },
                races
            )).toBe('race_id');
        });

        it('falls back to the single primary key of the target', () => {
            expect(resolveForeignKeyTargetAttribute(
                { name: 'race_id', targetModel: 'races' },
                races
            )).toBe('race_id');
        });
    });

    describe('isPrimaryKeyIndex', () => {
        it('is true when the field set equals the primary key set regardless of order', () => {
            expect(isPrimaryKeyIndex(['b', 'a'], ['a', 'b'])).toBe(true);
        });

        it('is false for a different field set', () => {
            expect(isPrimaryKeyIndex(['a'], ['a', 'b'])).toBe(false);
            expect(isPrimaryKeyIndex(['c'], ['a'])).toBe(false);
        });

        it('is false when there is no primary key', () => {
            expect(isPrimaryKeyIndex(['a'], [])).toBe(false);
        });
    });

    describe('collectTableIndexes', () => {
        it('collects unique and non-unique indexes and skips the primary key index', () => {
            const table = buildTable([
                buildColumn({
                    name: 'id',
                    primaryKey: true,
                    autoIncrement: true,
                    indices: [{ name: 'sqlite_autoindex_indices_1', unique: true, seq: 1 }],
                }),
                buildColumn({
                    name: 'f_unique',
                    indices: [{ name: 'indices_f_unique_uindex', unique: true, seq: 1 }],
                }),
                buildColumn({
                    name: 'f_not_unique',
                    indices: [{ name: 'indices_f_not_unique_index', unique: false, seq: 1 }],
                }),
            ]);

            expect(collectTableIndexes(table)).toEqual([
                { name: 'indices_f_unique_uindex', isUnique: true, fields: ['f_unique'] },
                { name: 'indices_f_not_unique_index', isUnique: false, fields: ['f_not_unique'] },
            ] satisfies INativeIndex[]);
        });

        it('orders multi-column index fields by seq and keeps first-seen index order', () => {
            const table = buildTable([
                buildColumn({
                    name: 'f_multi_2',
                    originName: 'f_multi_2',
                    indices: [{ name: 'indices_multi_uindex', unique: true, seq: 2 }],
                }),
                buildColumn({
                    name: 'f_multi_1',
                    originName: 'f_multi_1',
                    indices: [{ name: 'indices_multi_uindex', unique: true, seq: 1 }],
                }),
            ]);

            expect(collectTableIndexes(table)).toEqual([
                { name: 'indices_multi_uindex', isUnique: true, fields: ['f_multi_1', 'f_multi_2'] },
            ] satisfies INativeIndex[]);
        });

        it('carries the index method when present', () => {
            const table = buildTable([
                buildColumn({
                    name: 'f_gin',
                    indices: [{ name: 'gin_index', unique: false, using: 'GIN', seq: 1 }],
                }),
            ]);

            expect(collectTableIndexes(table)).toEqual([
                { name: 'gin_index', isUnique: false, fields: ['f_gin'], using: 'GIN' },
            ] satisfies INativeIndex[]);
        });

        it('uses the database column name for index fields', () => {
            const table = buildTable([
                buildColumn({
                    name: 'personId',
                    originName: 'person_id',
                    indices: [{ name: 'sqlite_autoindex_profiles_2', unique: true, seq: 1 }],
                }),
            ]);

            expect(collectTableIndexes(table)).toEqual([
                { name: 'sqlite_autoindex_profiles_2', isUnique: true, fields: ['person_id'] },
            ] satisfies INativeIndex[]);
        });
    });

});
