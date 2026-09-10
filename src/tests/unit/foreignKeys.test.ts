import {
    isReferentialAction,
    normalizeReferentialAction,
    groupForeignKeyRows,
    applyForeignKeyConstraintsToColumns,
    classifyForeignKeyConstraint,
    mapForeignKeyQueryRow,
    IForeignKeyColumnRow,
    IForeignKeyQueryRow,
} from '../../dialects/foreignKeys.js';
import { ITableMetadata, IForeignKeyConstraintMetadata } from '../../dialects/Dialect.js';

const buildRow = (overrides: Partial<IForeignKeyColumnRow>): IForeignKeyColumnRow => ({
    constraintName: 'fk',
    sourceTable: 'source',
    sourceColumn: 'source_col',
    targetTable: 'target',
    targetColumn: 'target_col',
    ordinalPosition: 1,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    isSourceColumnUnique: false,
    ...overrides,
});

describe('foreign key helpers', () => {

    describe('isReferentialAction', () => {
        it('accepts known actions and rejects anything else', () => {
            expect(isReferentialAction('CASCADE')).toBe(true);
            expect(isReferentialAction('SET NULL')).toBe(true);
            expect(isReferentialAction('cascade')).toBe(false);
            expect(isReferentialAction('BOGUS')).toBe(false);
        });
    });

    describe('normalizeReferentialAction', () => {
        it('normalizes underscore spellings', () => {
            expect(normalizeReferentialAction('NO_ACTION')).toBe('NO ACTION');
            expect(normalizeReferentialAction('set null')).toBe('SET NULL');
            expect(normalizeReferentialAction('SET_DEFAULT')).toBe('SET DEFAULT');
            expect(normalizeReferentialAction('CASCADE')).toBe('CASCADE');
            expect(normalizeReferentialAction('RESTRICT')).toBe('RESTRICT');
        });

        it('maps single-letter Postgres codes', () => {
            expect(normalizeReferentialAction('a')).toBe('NO ACTION');
            expect(normalizeReferentialAction('r')).toBe('RESTRICT');
            expect(normalizeReferentialAction('c')).toBe('CASCADE');
            expect(normalizeReferentialAction('n')).toBe('SET NULL');
            expect(normalizeReferentialAction('d')).toBe('SET DEFAULT');
        });

        it('falls back to NO ACTION for unknown, null and undefined', () => {
            expect(normalizeReferentialAction('garbage')).toBe('NO ACTION');
            expect(normalizeReferentialAction(null)).toBe('NO ACTION');
            expect(normalizeReferentialAction(undefined)).toBe('NO ACTION');
        });
    });

    describe('mapForeignKeyQueryRow', () => {
        const buildQueryRow = (
            uniqueness: IForeignKeyQueryRow['is_source_column_unique']
        ): IForeignKeyQueryRow => ({
            constraint_name: 'fk',
            source_table: 'source',
            source_column: 'source_col',
            target_schema: 'public',
            target_table: 'target',
            target_column: 'target_col',
            ordinal_position: 1,
            on_delete: 'CASCADE',
            on_update: 'NO ACTION',
            is_source_column_unique: uniqueness,
        });

        it('maps snake_case query fields onto the normalized row', () => {
            expect(mapForeignKeyQueryRow(buildQueryRow(0))).toEqual({
                constraintName: 'fk',
                sourceTable: 'source',
                sourceColumn: 'source_col',
                targetSchema: 'public',
                targetTable: 'target',
                targetColumn: 'target_col',
                ordinalPosition: 1,
                onDelete: 'CASCADE',
                onUpdate: 'NO ACTION',
                isSourceColumnUnique: false,
            });
        });

        it('coerces a truthy uniqueness value regardless of its dialect shape', () => {
            expect(mapForeignKeyQueryRow(buildQueryRow(true)).isSourceColumnUnique).toBe(true);
            expect(mapForeignKeyQueryRow(buildQueryRow(1)).isSourceColumnUnique).toBe(true);
            expect(mapForeignKeyQueryRow(buildQueryRow('1')).isSourceColumnUnique).toBe(true);
        });

        it('coerces a falsy uniqueness value regardless of its dialect shape', () => {
            expect(mapForeignKeyQueryRow(buildQueryRow(false)).isSourceColumnUnique).toBe(false);
            expect(mapForeignKeyQueryRow(buildQueryRow(0)).isSourceColumnUnique).toBe(false);
            expect(mapForeignKeyQueryRow(buildQueryRow('0')).isSourceColumnUnique).toBe(false);
        });
    });

    describe('groupForeignKeyRows', () => {
        it('groups interleaved constraints and keeps single-column unique flag', () => {
            const rows: IForeignKeyColumnRow[] = [
                buildRow({ constraintName: 'fk_a', sourceColumn: 'a1', targetColumn: 't1', isSourceColumnUnique: true }),
                buildRow({ constraintName: 'fk_b', sourceColumn: 'b1', targetColumn: 'u1', ordinalPosition: 1 }),
                buildRow({ constraintName: 'fk_a', sourceColumn: 'a1_again', targetColumn: 't1', ordinalPosition: 2 }),
            ];

            const constraints = groupForeignKeyRows(rows);

            expect(constraints).toHaveLength(2);
            const [first, second] = constraints;
            expect(first.constraintName).toBe('fk_a');
            expect(first.sourceColumns).toEqual(['a1', 'a1_again']);
            expect(second.constraintName).toBe('fk_b');
            expect(second.sourceColumns).toEqual(['b1']);
            expect(second.isSourceColumnUnique).toBe(false);
        });

        it('orders composite columns by ordinal position and forces unique to false', () => {
            const rows: IForeignKeyColumnRow[] = [
                buildRow({ constraintName: 'fk_c', sourceColumn: 'second', targetColumn: 'ts', ordinalPosition: 2, isSourceColumnUnique: true }),
                buildRow({ constraintName: 'fk_c', sourceColumn: 'first', targetColumn: 'tf', ordinalPosition: 1, isSourceColumnUnique: true }),
            ];

            const [constraint] = groupForeignKeyRows(rows);

            expect(constraint.sourceColumns).toEqual(['first', 'second']);
            expect(constraint.targetColumns).toEqual(['tf', 'ts']);
            expect(constraint.isSourceColumnUnique).toBe(false);
        });
    });

    describe('classifyForeignKeyConstraint', () => {
        const buildConstraint = (
            overrides: Partial<IForeignKeyConstraintMetadata>
        ): IForeignKeyConstraintMetadata => ({
            constraintName: 'fk',
            sourceTable: 'units',
            sourceColumns: ['race_id'],
            targetSchema: 'public',
            targetTable: 'races',
            targetColumns: ['race_id'],
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
            isSourceColumnUnique: false,
            ...overrides,
        });

        const generatedTables = new Set(['units', 'races']);

        it('accepts a single-column, same-schema, generated-target constraint', () => {
            expect(classifyForeignKeyConstraint(buildConstraint({}), 'public', generatedTables)).toEqual({
                isEligible: true,
            });
        });

        it('rejects a composite constraint first', () => {
            const constraint = buildConstraint({
                sourceColumns: ['order_id', 'line_no'],
                targetTable: 'not_generated',
                targetSchema: 'other',
            });

            expect(classifyForeignKeyConstraint(constraint, 'public', generatedTables)).toEqual({
                isEligible: false,
                reason: 'composite',
            });
        });

        it('rejects a cross-schema constraint before an excluded target', () => {
            const constraint = buildConstraint({ targetSchema: 'other', targetTable: 'not_generated' });

            expect(classifyForeignKeyConstraint(constraint, 'public', generatedTables)).toEqual({
                isEligible: false,
                reason: 'cross-schema',
            });
        });

        it('rejects a constraint whose target is not generated', () => {
            const constraint = buildConstraint({ targetTable: 'not_generated' });

            expect(classifyForeignKeyConstraint(constraint, 'public', generatedTables)).toEqual({
                isEligible: false,
                reason: 'excluded-target',
            });
        });

        it('ignores the schema check when either schema is undefined', () => {
            const constraint = buildConstraint({ targetSchema: 'other' });

            expect(classifyForeignKeyConstraint(constraint, undefined, generatedTables)).toEqual({
                isEligible: true,
            });
        });
    });

    describe('applyForeignKeyConstraintsToColumns', () => {
        const buildTableMetadata = (): ITableMetadata => ({
            name: 'units',
            originName: 'units',
            schema: 'public',
            columns: {
                race_id: {
                    name: 'race_id',
                    originName: 'race_id',
                    type: 'int4',
                    typeExt: 'integer',
                    primaryKey: false,
                    allowNull: true,
                    autoIncrement: false,
                },
                order_id: {
                    name: 'order_id',
                    originName: 'order_id',
                    type: 'int4',
                    typeExt: 'integer',
                    primaryKey: false,
                    allowNull: true,
                    autoIncrement: false,
                },
                line_no: {
                    name: 'line_no',
                    originName: 'line_no',
                    type: 'int4',
                    typeExt: 'integer',
                    primaryKey: false,
                    allowNull: true,
                    autoIncrement: false,
                },
                other_id: {
                    name: 'other_id',
                    originName: 'other_id',
                    type: 'int4',
                    typeExt: 'integer',
                    primaryKey: false,
                    allowNull: true,
                    autoIncrement: false,
                },
                external_id: {
                    name: 'external_id',
                    originName: 'external_id',
                    type: 'int4',
                    typeExt: 'integer',
                    primaryKey: false,
                    allowNull: true,
                    autoIncrement: false,
                },
            },
            foreignKeys: [
                {
                    constraintName: 'units_race_id_fk',
                    sourceTable: 'units',
                    sourceColumns: ['race_id'],
                    targetSchema: 'public',
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                    onDelete: 'CASCADE',
                    onUpdate: 'RESTRICT',
                    isSourceColumnUnique: false,
                },
                {
                    constraintName: 'units_order_line_fk',
                    sourceTable: 'units',
                    sourceColumns: ['order_id', 'line_no'],
                    targetSchema: 'public',
                    targetTable: 'order_lines',
                    targetColumns: ['order_id', 'line_no'],
                    onDelete: 'NO ACTION',
                    onUpdate: 'NO ACTION',
                    isSourceColumnUnique: false,
                },
                {
                    constraintName: 'units_other_fk',
                    sourceTable: 'units',
                    sourceColumns: ['other_id'],
                    targetSchema: 'public',
                    targetTable: 'not_generated',
                    targetColumns: ['id'],
                    onDelete: 'NO ACTION',
                    onUpdate: 'NO ACTION',
                    isSourceColumnUnique: false,
                },
                {
                    constraintName: 'units_external_fk',
                    sourceTable: 'units',
                    sourceColumns: ['external_id'],
                    targetSchema: 'other_schema',
                    targetTable: 'races',
                    targetColumns: ['race_id'],
                    onDelete: 'NO ACTION',
                    onUpdate: 'NO ACTION',
                    isSourceColumnUnique: false,
                },
            ],
        });

        const generatedTables = new Set(['units', 'races', 'order_lines']);

        it('copies a single-column constraint onto the column foreignKey', () => {
            const result = applyForeignKeyConstraintsToColumns(buildTableMetadata(), generatedTables);

            expect(result.columns.race_id.foreignKey).toEqual({
                name: 'race_id',
                targetModel: 'races',
                targetKey: 'race_id',
                constraintName: 'units_race_id_fk',
                onDelete: 'CASCADE',
                onUpdate: 'RESTRICT',
                isUnique: false,
            });
        });

        it('skips composite, excluded-target and cross-schema constraints', () => {
            const result = applyForeignKeyConstraintsToColumns(buildTableMetadata(), generatedTables);

            expect(result.columns.order_id.foreignKey).toBeUndefined();
            expect(result.columns.line_no.foreignKey).toBeUndefined();
            expect(result.columns.other_id.foreignKey).toBeUndefined();
            expect(result.columns.external_id.foreignKey).toBeUndefined();
        });

        it('does not mutate the input table metadata', () => {
            const input = buildTableMetadata();

            applyForeignKeyConstraintsToColumns(input, generatedTables);

            expect(input.columns.race_id.foreignKey).toBeUndefined();
        });
    });

});
