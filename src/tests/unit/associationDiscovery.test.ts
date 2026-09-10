import {
    discoverAssociations,
    stripForeignKeyColumnSuffix,
    resolveAssociationAliases,
    formatForeignKeySkipWarning,
    isAssociationDiscoveryEnabled,
    FOREIGN_KEY_COLUMN_SUFFIXES,
} from '../../dialects/associationDiscovery.js';
import {
    ITablesMetadata,
    ITableMetadata,
    IColumnMetadata,
    IForeignKeyConstraintMetadata,
} from '../../dialects/Dialect.js';
import { IAssociationMetadata } from '../../dialects/AssociationsParser.js';

const buildColumn = (overrides: Partial<IColumnMetadata> & { name: string }): IColumnMetadata => ({
    originName: overrides.name,
    type: 'int4',
    typeExt: 'integer',
    primaryKey: false,
    allowNull: true,
    autoIncrement: false,
    ...overrides,
});

const buildConstraint = (
    overrides: Partial<IForeignKeyConstraintMetadata> & {
        constraintName: string;
        sourceTable: string;
        sourceColumns: string[];
        targetTable: string;
        targetColumns: string[];
    }
): IForeignKeyConstraintMetadata => ({
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    isSourceColumnUnique: false,
    ...overrides,
});

const buildTable = (
    name: string,
    columns: IColumnMetadata[],
    foreignKeys: IForeignKeyConstraintMetadata[] = [],
    schema?: string
): ITableMetadata => ({
    name,
    originName: name,
    ...(schema !== undefined && { schema }),
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    foreignKeys,
});

const toMetadata = (tables: ITableMetadata[]): ITablesMetadata =>
    Object.fromEntries(tables.map(table => [table.originName, table]));

const associationsOf = (metadata: ITablesMetadata, table: string): IAssociationMetadata[] =>
    metadata[table].associations ?? [];

describe('associationDiscovery', () => {

    describe('FOREIGN_KEY_COLUMN_SUFFIXES', () => {
        it('lists the recognised suffixes', () => {
            expect(FOREIGN_KEY_COLUMN_SUFFIXES).toEqual(['_id', '_fk', 'Id', 'Fk']);
        });
    });

    describe('stripForeignKeyColumnSuffix', () => {
        it('strips a matching suffix', () => {
            expect(stripForeignKeyColumnSuffix('race_id')).toBe('race');
            expect(stripForeignKeyColumnSuffix('manager_id')).toBe('manager');
            expect(stripForeignKeyColumnSuffix('owner_fk')).toBe('owner');
            expect(stripForeignKeyColumnSuffix('authorId')).toBe('author');
            expect(stripForeignKeyColumnSuffix('authorFk')).toBe('author');
        });

        it('returns undefined without a suffix or with an empty remainder', () => {
            expect(stripForeignKeyColumnSuffix('owner')).toBeUndefined();
            expect(stripForeignKeyColumnSuffix('_id')).toBeUndefined();
            expect(stripForeignKeyColumnSuffix('Id')).toBeUndefined();
        });
    });

    describe('resolveAssociationAliases', () => {
        it('uses singular/plural model names when unambiguous', () => {
            expect(resolveAssociationAliases({
                sourceModel: 'units',
                targetModel: 'races',
                foreignKeyColumn: 'race_id',
                isAmbiguous: false,
                isOneToOne: false,
            })).toEqual({ belongsToAlias: 'race', hasAlias: 'units' });
        });

        it('uses the singular source side for a one-to-one association', () => {
            expect(resolveAssociationAliases({
                sourceModel: 'profiles',
                targetModel: 'person',
                foreignKeyColumn: 'person_id',
                isAmbiguous: false,
                isOneToOne: true,
            })).toEqual({ belongsToAlias: 'person', hasAlias: 'profile' });
        });

        it('uses the stripped stem when ambiguous and the column has a suffix', () => {
            expect(resolveAssociationAliases({
                sourceModel: 'books',
                targetModel: 'authors',
                foreignKeyColumn: 'author_id',
                isAmbiguous: true,
                isOneToOne: false,
            })).toEqual({ belongsToAlias: 'author', hasAlias: 'authorBooks' });
        });

        it('composes a fallback alias when ambiguous and the column has no suffix', () => {
            expect(resolveAssociationAliases({
                sourceModel: 'books',
                targetModel: 'authors',
                foreignKeyColumn: 'owner',
                isAmbiguous: true,
                isOneToOne: false,
            })).toEqual({ belongsToAlias: 'authorOwner', hasAlias: 'ownerBooks' });
        });
    });

    describe('cardinality', () => {
        it('produces BelongsTo and HasMany for a plain foreign key', () => {
            const races = buildTable('races', [buildColumn({ name: 'race_id', primaryKey: true })]);
            const units = buildTable(
                'units',
                [
                    buildColumn({ name: 'unit_id', primaryKey: true }),
                    buildColumn({ name: 'race_id' }),
                ],
                [buildConstraint({
                    constraintName: 'units_race_fk',
                    sourceTable: 'units',
                    sourceColumns: ['race_id'],
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([races, units]));

            expect(associationsOf(tablesMetadata, 'units')).toEqual([
                {
                    associationName: 'BelongsTo',
                    targetModel: 'races',
                    alias: 'race',
                    foreignKey: 'race_id',
                    targetKey: 'race_id',
                },
            ]);
            expect(associationsOf(tablesMetadata, 'races')).toEqual([
                {
                    associationName: 'HasMany',
                    targetModel: 'units',
                    alias: 'units',
                    foreignKey: 'race_id',
                    sourceKey: 'race_id',
                },
            ]);
        });

        it('produces HasOne when the foreign key column is unique', () => {
            const person = buildTable('person', [buildColumn({ name: 'person_id', primaryKey: true })]);
            const profiles = buildTable(
                'profiles',
                [
                    buildColumn({ name: 'profile_id', primaryKey: true }),
                    buildColumn({ name: 'person_id' }),
                ],
                [buildConstraint({
                    constraintName: 'profiles_person_fk',
                    sourceTable: 'profiles',
                    sourceColumns: ['person_id'],
                    targetTable: 'person',
                    targetColumns: ['person_id'],
                    isSourceColumnUnique: true,
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([person, profiles]));

            expect(associationsOf(tablesMetadata, 'person')).toEqual([
                {
                    associationName: 'HasOne',
                    targetModel: 'profiles',
                    alias: 'profile',
                    foreignKey: 'person_id',
                    sourceKey: 'person_id',
                },
            ]);
        });

        it('produces HasOne when the foreign key is the single primary key column', () => {
            const person = buildTable('person', [buildColumn({ name: 'person_id', primaryKey: true })]);
            const passport = buildTable(
                'passport',
                [buildColumn({ name: 'person_id', primaryKey: true })],
                [buildConstraint({
                    constraintName: 'passport_person_fk',
                    sourceTable: 'passport',
                    sourceColumns: ['person_id'],
                    targetTable: 'person',
                    targetColumns: ['person_id'],
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([person, passport]));

            expect(associationsOf(tablesMetadata, 'person')[0].associationName).toBe('HasOne');
            expect(associationsOf(tablesMetadata, 'passport')[0].associationName).toBe('BelongsTo');
        });

        it('produces HasMany when the foreign key is part of a composite primary key', () => {
            const items = buildTable('items', [buildColumn({ name: 'item_id', primaryKey: true })]);
            const carts = buildTable(
                'carts',
                [
                    buildColumn({ name: 'cart_id', primaryKey: true }),
                    buildColumn({ name: 'item_id', primaryKey: true }),
                ],
                [buildConstraint({
                    constraintName: 'carts_item_fk',
                    sourceTable: 'carts',
                    sourceColumns: ['item_id'],
                    targetTable: 'items',
                    targetColumns: ['item_id'],
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([items, carts]));

            expect(associationsOf(tablesMetadata, 'items')[0].associationName).toBe('HasMany');
        });
    });

    describe('referential actions', () => {
        it('sets on-rules only when the normalized rule is not NO ACTION', () => {
            const races = buildTable('races', [buildColumn({ name: 'race_id', primaryKey: true })]);
            const units = buildTable(
                'units',
                [
                    buildColumn({ name: 'unit_id', primaryKey: true }),
                    buildColumn({ name: 'race_id' }),
                ],
                [buildConstraint({
                    constraintName: 'units_race_fk',
                    sourceTable: 'units',
                    sourceColumns: ['race_id'],
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                    onDelete: 'CASCADE',
                    onUpdate: 'NO ACTION',
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([races, units]));

            const belongsTo = associationsOf(tablesMetadata, 'units')[0];
            const hasMany = associationsOf(tablesMetadata, 'races')[0];

            expect(belongsTo.onDelete).toBe('CASCADE');
            expect(belongsTo.onUpdate).toBeUndefined();
            expect(hasMany.onDelete).toBe('CASCADE');
            expect(hasMany.onUpdate).toBeUndefined();
            expect('onUpdate' in belongsTo).toBe(false);
        });
    });

    describe('self-reference', () => {
        it('places both sides on the source model with BelongsTo first', () => {
            const employees = buildTable(
                'employees',
                [
                    buildColumn({ name: 'employee_id', primaryKey: true }),
                    buildColumn({ name: 'manager_id' }),
                ],
                [buildConstraint({
                    constraintName: 'employees_manager_fk',
                    sourceTable: 'employees',
                    sourceColumns: ['manager_id'],
                    targetTable: 'employees',
                    targetColumns: ['employee_id'],
                    onDelete: 'SET NULL',
                })]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([employees]));

            expect(associationsOf(tablesMetadata, 'employees')).toEqual([
                {
                    associationName: 'BelongsTo',
                    targetModel: 'employees',
                    alias: 'manager',
                    foreignKey: 'manager_id',
                    targetKey: 'employee_id',
                    onDelete: 'SET NULL',
                },
                {
                    associationName: 'HasMany',
                    targetModel: 'employees',
                    alias: 'managerEmployees',
                    foreignKey: 'manager_id',
                    sourceKey: 'employee_id',
                    onDelete: 'SET NULL',
                },
            ]);
        });
    });

    describe('ambiguous constraints to the same target', () => {
        it('derives distinct aliases from the foreign key stems', () => {
            const authors = buildTable('authors', [buildColumn({ name: 'author_id', primaryKey: true })]);
            const books = buildTable(
                'books',
                [
                    buildColumn({ name: 'book_id', primaryKey: true }),
                    buildColumn({ name: 'author_id' }),
                    buildColumn({ name: 'editor_id' }),
                ],
                [
                    buildConstraint({
                        constraintName: 'books_author_fk',
                        sourceTable: 'books',
                        sourceColumns: ['author_id'],
                        targetTable: 'authors',
                        targetColumns: ['author_id'],
                    }),
                    buildConstraint({
                        constraintName: 'books_editor_fk',
                        sourceTable: 'books',
                        sourceColumns: ['editor_id'],
                        targetTable: 'authors',
                        targetColumns: ['author_id'],
                    }),
                ]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([authors, books]));

            expect(associationsOf(tablesMetadata, 'books').map(association => association.alias))
                .toEqual(['author', 'editor']);
            expect(associationsOf(tablesMetadata, 'authors').map(association => association.alias))
                .toEqual(['authorBooks', 'editorBooks']);
        });
    });

    describe('collisions', () => {
        it('falls back to a numeric suffix when the fallback alias is taken', () => {
            const users = buildTable('users', [buildColumn({ name: 'user_id', primaryKey: true })]);
            const posts = buildTable(
                'posts',
                [
                    buildColumn({ name: 'post_id', primaryKey: true }),
                    buildColumn({ name: 'ref' }),
                    buildColumn({ name: 'author' }),
                    buildColumn({ name: 'userRef' }),
                ],
                [
                    buildConstraint({
                        constraintName: 'posts_ref_fk',
                        sourceTable: 'posts',
                        sourceColumns: ['ref'],
                        targetTable: 'users',
                        targetColumns: ['user_id'],
                    }),
                    buildConstraint({
                        constraintName: 'posts_author_fk',
                        sourceTable: 'posts',
                        sourceColumns: ['author'],
                        targetTable: 'users',
                        targetColumns: ['user_id'],
                    }),
                ]
            );

            const { tablesMetadata } = discoverAssociations(toMetadata([users, posts]));

            const refAssociation = associationsOf(tablesMetadata, 'posts')
                .find(association => association.foreignKey === 'ref');

            expect(refAssociation?.alias).toBe('userRef2');
        });
    });

    describe('skipped constraints', () => {
        it('emits the composite warning and no associations', () => {
            const orderLines = buildTable(
                'order_lines',
                [
                    buildColumn({ name: 'order_id', primaryKey: true }),
                    buildColumn({ name: 'line_no', primaryKey: true }),
                ]
            );
            const shipments = buildTable(
                'shipments',
                [
                    buildColumn({ name: 'shipment_id', primaryKey: true }),
                    buildColumn({ name: 'order_id' }),
                    buildColumn({ name: 'line_no' }),
                ],
                [buildConstraint({
                    constraintName: 'shipments_order_line_fk',
                    sourceTable: 'shipments',
                    sourceColumns: ['order_id', 'line_no'],
                    targetTable: 'order_lines',
                    targetColumns: ['order_id', 'line_no'],
                })]
            );

            const { tablesMetadata, warnings } = discoverAssociations(toMetadata([orderLines, shipments]));

            expect(warnings).toEqual([
                "Foreign key constraint 'shipments_order_line_fk' on table 'shipments' spans columns "
                + '(order_id, line_no); Sequelize associations need a single column, so the columns are '
                + 'generated as plain attributes',
            ]);
            expect(associationsOf(tablesMetadata, 'shipments')).toEqual([]);
            expect(associationsOf(tablesMetadata, 'order_lines')).toEqual([]);
        });

        it('emits the cross-schema warning', () => {
            const races = buildTable('races', [buildColumn({ name: 'race_id', primaryKey: true })], [], 'public');
            const units = buildTable(
                'units',
                [
                    buildColumn({ name: 'unit_id', primaryKey: true }),
                    buildColumn({ name: 'race_id' }),
                ],
                [buildConstraint({
                    constraintName: 'units_race_fk',
                    sourceTable: 'units',
                    sourceColumns: ['race_id'],
                    targetSchema: 'other',
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                })],
                'public'
            );

            const { warnings } = discoverAssociations(toMetadata([races, units]));

            expect(warnings).toEqual([
                "Foreign key constraint 'units_race_fk' on table 'public.units' references table "
                + "'other.races' in another schema; the column is generated as a plain attribute",
            ]);
        });

        it('emits the excluded-target warning', () => {
            const units = buildTable(
                'units',
                [
                    buildColumn({ name: 'unit_id', primaryKey: true }),
                    buildColumn({ name: 'ghost_id' }),
                ],
                [buildConstraint({
                    constraintName: 'units_ghost_fk',
                    sourceTable: 'units',
                    sourceColumns: ['ghost_id'],
                    targetTable: 'ghosts',
                    targetColumns: ['ghost_id'],
                })]
            );

            const { warnings } = discoverAssociations(toMetadata([units]));

            expect(warnings).toEqual([
                "Foreign key constraint 'units_ghost_fk' on table 'units' references table 'ghosts', "
                + 'which is not among the generated tables; the column is generated as a plain attribute',
            ]);
        });
    });

    describe('formatForeignKeySkipWarning', () => {
        it('formats each reason with the exact wording', () => {
            const composite = buildConstraint({
                constraintName: 'fk_c',
                sourceTable: 'shipments',
                sourceColumns: ['order_id', 'line_no'],
                targetTable: 'order_lines',
                targetColumns: ['order_id', 'line_no'],
            });
            const crossSchema = buildConstraint({
                constraintName: 'fk_x',
                sourceTable: 'units',
                sourceColumns: ['race_id'],
                targetSchema: 'other',
                targetTable: 'races',
                targetColumns: ['race_id'],
            });
            const excluded = buildConstraint({
                constraintName: 'fk_e',
                sourceTable: 'units',
                sourceColumns: ['ghost_id'],
                targetTable: 'ghosts',
                targetColumns: ['ghost_id'],
            });

            expect(formatForeignKeySkipWarning(composite, 'public', 'composite')).toBe(
                "Foreign key constraint 'fk_c' on table 'shipments' spans columns (order_id, line_no); "
                + 'Sequelize associations need a single column, so the columns are generated as plain attributes'
            );
            expect(formatForeignKeySkipWarning(crossSchema, 'public', 'cross-schema')).toBe(
                "Foreign key constraint 'fk_x' on table 'public.units' references table 'other.races' in "
                + 'another schema; the column is generated as a plain attribute'
            );
            expect(formatForeignKeySkipWarning(excluded, 'public', 'excluded-target')).toBe(
                "Foreign key constraint 'fk_e' on table 'units' references table 'ghosts', which is not among "
                + 'the generated tables; the column is generated as a plain attribute'
            );
        });
    });

    describe('immutability and determinism', () => {
        const buildFixture = (): ITablesMetadata => {
            const races = buildTable('races', [buildColumn({ name: 'race_id', primaryKey: true })]);
            const units = buildTable(
                'units',
                [
                    buildColumn({ name: 'unit_id', primaryKey: true }),
                    buildColumn({ name: 'race_id' }),
                ],
                [buildConstraint({
                    constraintName: 'units_race_fk',
                    sourceTable: 'units',
                    sourceColumns: ['race_id'],
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                })]
            );

            return toMetadata([races, units]);
        };

        it('does not mutate the input', () => {
            const input = buildFixture();
            const snapshot = JSON.stringify(input);

            const { tablesMetadata } = discoverAssociations(input);

            expect(JSON.stringify(input)).toBe(snapshot);
            expect(tablesMetadata).not.toBe(input);
            expect(input.races.associations).toBeUndefined();
        });

        it('produces the same output on repeated runs', () => {
            const first = discoverAssociations(buildFixture());
            const second = discoverAssociations(buildFixture());

            expect(second.tablesMetadata).toEqual(first.tablesMetadata);
            expect(second.warnings).toEqual(first.warnings);
        });
    });

    describe('isAssociationDiscoveryEnabled', () => {
        it('is enabled unless associations is explicitly false', () => {
            expect(isAssociationDiscoveryEnabled(undefined)).toBe(true);
            expect(isAssociationDiscoveryEnabled({})).toBe(true);
            expect(isAssociationDiscoveryEnabled({ associations: true })).toBe(true);
            expect(isAssociationDiscoveryEnabled({ associations: false })).toBe(false);
        });
    });

});
