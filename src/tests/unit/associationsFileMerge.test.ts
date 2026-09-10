import { applyAssociationsFile } from '../../dialects/associationsFileMerge.js';
import {
    ITablesMetadata,
    ITableMetadata,
    IColumnMetadata,
} from '../../dialects/Dialect.js';
import { IAssociationsParsed, IAssociationMetadata } from '../../dialects/AssociationsParser.js';

const buildColumn = (overrides: Partial<IColumnMetadata> & { name: string }): IColumnMetadata => ({
    originName: overrides.name,
    type: 'int4',
    typeExt: 'integer',
    primaryKey: false,
    allowNull: true,
    autoIncrement: false,
    ...overrides,
});

const buildTable = (
    name: string,
    columns: IColumnMetadata[],
    associations: IAssociationMetadata[] = []
): ITableMetadata => ({
    name,
    originName: name,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    associations,
});

const toMetadata = (tables: ITableMetadata[]): ITablesMetadata =>
    Object.fromEntries(tables.map(table => [table.originName, table]));

const associationsOf = (metadata: ITablesMetadata, table: string): IAssociationMetadata[] =>
    metadata[table].associations ?? [];

// units.race (BelongsTo) paired with races.units (HasMany), as association discovery produces them.
const buildDiscoveredMetadata = (): ITablesMetadata =>
    toMetadata([
        buildTable('races', [buildColumn({ name: 'race_id', primaryKey: true })], [
            {
                associationName: 'HasMany',
                targetModel: 'units',
                alias: 'units',
                foreignKey: 'race_id',
                sourceKey: 'race_id',
            },
        ]),
        buildTable(
            'units',
            [
                buildColumn({ name: 'unit_id', primaryKey: true }),
                buildColumn({
                    name: 'race_id',
                    foreignKey: {
                        name: 'race_id',
                        targetModel: 'races',
                        targetKey: 'race_id',
                        constraintName: 'units_race_fk',
                    },
                }),
            ],
            [
                {
                    associationName: 'BelongsTo',
                    targetModel: 'races',
                    alias: 'race',
                    foreignKey: 'race_id',
                    targetKey: 'race_id',
                },
            ]
        ),
    ]);

// A one-to-many declaration whose foreign key sits on units.race_id.
const buildOneToManyParsed = (): IAssociationsParsed => ({
    races: {
        foreignKeys: [],
        associations: [{ associationName: 'HasMany', targetModel: 'units', sourceKey: 'race_id' }],
    },
    units: {
        foreignKeys: [{ name: 'race_id', targetModel: 'races', isJunctionForeignKey: false }],
        associations: [{ associationName: 'BelongsTo', targetModel: 'races' }],
    },
});

describe('applyAssociationsFile', () => {

    describe('missing table', () => {
        it('warns and continues', () => {
            const parsed: IAssociationsParsed = {
                ghosts: {
                    foreignKeys: [],
                    associations: [{ associationName: 'BelongsTo', targetModel: 'races' }],
                },
            };

            const { warnings } = applyAssociationsFile(buildDiscoveredMetadata(), parsed);

            expect(warnings).toEqual([
                'Associated table ghosts not found among (races, units)',
            ]);
        });
    });

    describe('non-junction foreign key', () => {
        it('removes the discovered BelongsTo and its paired Has*, then appends the declared pair', () => {
            const { tablesMetadata } = applyAssociationsFile(buildDiscoveredMetadata(), buildOneToManyParsed());

            expect(associationsOf(tablesMetadata, 'units')).toEqual([
                { associationName: 'BelongsTo', targetModel: 'races' },
            ]);
            expect(associationsOf(tablesMetadata, 'races')).toEqual([
                { associationName: 'HasMany', targetModel: 'units', sourceKey: 'race_id' },
            ]);
        });

        it('rewrites the column foreign key, preserving discovered fields when the target matches', () => {
            const { tablesMetadata } = applyAssociationsFile(buildDiscoveredMetadata(), buildOneToManyParsed());

            expect(tablesMetadata.units.columns.race_id.foreignKey).toEqual({
                name: 'race_id',
                targetModel: 'races',
                targetKey: 'race_id',
                constraintName: 'units_race_fk',
            });
        });

        it('drops discovered column foreign key fields when the declared target differs', () => {
            const parsed: IAssociationsParsed = {
                units: {
                    foreignKeys: [{ name: 'race_id', targetModel: 'seasons', isJunctionForeignKey: false }],
                    associations: [{ associationName: 'BelongsTo', targetModel: 'seasons' }],
                },
            };

            const { tablesMetadata } = applyAssociationsFile(buildDiscoveredMetadata(), parsed);

            expect(tablesMetadata.units.columns.race_id.foreignKey).toEqual({
                name: 'race_id',
                targetModel: 'seasons',
            });
        });
    });

    describe('missing column', () => {
        it('warns and continues', () => {
            const parsed: IAssociationsParsed = {
                units: {
                    foreignKeys: [{ name: 'ghost_id', targetModel: 'races', isJunctionForeignKey: false }],
                    associations: [],
                },
            };

            const { warnings } = applyAssociationsFile(buildDiscoveredMetadata(), parsed);

            expect(warnings).toEqual([
                'Foreign key column ghost_id not found among (unit_id, race_id)',
            ]);
        });
    });

    describe('junction foreign key', () => {
        it('removes no discovered association', () => {
            const authors = buildTable('authors', [buildColumn({ name: 'author_id', primaryKey: true })]);
            const books = buildTable('books', [buildColumn({ name: 'book_id', primaryKey: true })]);
            const authorsBooks = buildTable('authors_books', [
                buildColumn({ name: 'author_id', primaryKey: true }),
                buildColumn({ name: 'book_id', primaryKey: true }),
            ], [
                {
                    associationName: 'BelongsTo',
                    targetModel: 'authors',
                    alias: 'author',
                    foreignKey: 'author_id',
                    targetKey: 'author_id',
                },
            ]);

            const parsed: IAssociationsParsed = {
                authors_books: {
                    foreignKeys: [
                        { name: 'author_id', targetModel: 'authors', isJunctionForeignKey: true },
                        { name: 'book_id', targetModel: 'books', isJunctionForeignKey: true },
                    ],
                    associations: [],
                },
            };

            const { tablesMetadata } = applyAssociationsFile(
                toMetadata([authors, books, authorsBooks]),
                parsed
            );

            expect(associationsOf(tablesMetadata, 'authors_books')).toEqual([
                {
                    associationName: 'BelongsTo',
                    targetModel: 'authors',
                    alias: 'author',
                    foreignKey: 'author_id',
                    targetKey: 'author_id',
                },
            ]);
        });
    });

    describe('append instead of overwrite', () => {
        it('keeps discovered associations that are not superseded by a declared foreign key', () => {
            const metadata = buildDiscoveredMetadata();
            metadata.units.associations = [
                ...associationsOf(metadata, 'units'),
                {
                    associationName: 'BelongsTo',
                    targetModel: 'seasons',
                    alias: 'season',
                    foreignKey: 'season_id',
                    targetKey: 'season_id',
                },
            ];

            const { tablesMetadata } = applyAssociationsFile(metadata, buildOneToManyParsed());

            expect(associationsOf(tablesMetadata, 'units')).toEqual([
                {
                    associationName: 'BelongsTo',
                    targetModel: 'seasons',
                    alias: 'season',
                    foreignKey: 'season_id',
                    targetKey: 'season_id',
                },
                { associationName: 'BelongsTo', targetModel: 'races' },
            ]);
        });
    });

    describe('alias collision', () => {
        it('drops the discovered association and keeps the declared one with a warning', () => {
            const authors = buildTable('authors', [buildColumn({ name: 'author_id', primaryKey: true })], [
                {
                    associationName: 'HasMany',
                    targetModel: 'books',
                    alias: 'books',
                    foreignKey: 'author_id',
                    sourceKey: 'author_id',
                },
            ]);
            const books = buildTable('books', [buildColumn({ name: 'book_id', primaryKey: true })]);

            const parsed: IAssociationsParsed = {
                authors: {
                    foreignKeys: [],
                    associations: [
                        { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books' },
                    ],
                },
            };

            const { tablesMetadata, warnings } = applyAssociationsFile(toMetadata([authors, books]), parsed);

            expect(associationsOf(tablesMetadata, 'authors')).toEqual([
                { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books' },
            ]);
            expect(warnings).toEqual([
                "Association alias 'books' on table 'authors' is used by both a discovered association "
                + 'and the associations file; the associations file entry is kept',
            ]);
        });
    });

    describe('immutability', () => {
        it('does not mutate the input metadata or the parsed associations', () => {
            const metadata = buildDiscoveredMetadata();
            const parsed = buildOneToManyParsed();
            const metadataSnapshot = JSON.stringify(metadata);
            const parsedSnapshot = JSON.stringify(parsed);

            applyAssociationsFile(metadata, parsed);

            expect(JSON.stringify(metadata)).toBe(metadataSnapshot);
            expect(JSON.stringify(parsed)).toBe(parsedSnapshot);
        });
    });

});
