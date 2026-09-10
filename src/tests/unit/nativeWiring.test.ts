import { renderInitModelsFile, renderNativeIndexFile } from '../../builders/nativeWiring.js';
import { renderNativeFiles } from '../../builders/generatedFile.js';
import { indexTablesByModelName } from '../../builders/nativeAttributes.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { ISequelizeDataType } from '../../dialects/dataTypes.js';

const dialect = new DialectSQLite();

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

const dataType = (key: ISequelizeDataType['key'], ...args: ISequelizeDataType['args']): ISequelizeDataType => ({ key, args });

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

const authors = buildTable('authors', [
    buildColumn({ name: 'author_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'name', type: 'varchar', sequelizeType: dataType('STRING') }),
], {
    associations: [
        { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books', alias: 'books' },
    ],
});

const books = buildTable('books', [
    buildColumn({ name: 'book_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'title', type: 'varchar', sequelizeType: dataType('STRING') }),
], {
    associations: [
        { associationName: 'BelongsToMany', targetModel: 'authors', joinModel: 'authors_books', alias: 'authors' },
    ],
});

const authorsBooks = buildTable('authors_books', [
    buildColumn({
        name: 'author_id',
        type: 'integer',
        sequelizeType: dataType('INTEGER'),
        foreignKey: { name: 'author_id', targetModel: 'authors', targetKey: 'author_id' },
    }),
    buildColumn({
        name: 'book_id',
        type: 'integer',
        sequelizeType: dataType('INTEGER'),
        foreignKey: { name: 'book_id', targetModel: 'books', targetKey: 'book_id' },
    }),
]);

const tablesMetadata: ITablesMetadata = {
    races, units, authors, books, authors_books: authorsBooks,
};
const tablesByModel = indexTablesByModelName(tablesMetadata);

describe('nativeWiring', () => {

    it('renders the initModels wiring file with value imports, init calls, association calls and the Models type', () => {
        expect(renderInitModelsFile(tablesMetadata, tablesByModel)).toBe(
`import { Sequelize } from "sequelize";
import { races } from "./races";
import { units } from "./units";
import { authors } from "./authors";
import { books } from "./books";
import { authors_books } from "./authors_books";

export function initModels(sequelize: Sequelize) {
    races.initModel(sequelize);
    units.initModel(sequelize);
    authors.initModel(sequelize);
    books.initModel(sequelize);
    authors_books.initModel(sequelize);
    races.hasMany(units, {
        as: "units",
        foreignKey: "race_id",
        sourceKey: "race_id"
    });
    units.belongsTo(races, {
        as: "race",
        foreignKey: "race_id",
        targetKey: "race_id"
    });
    authors.belongsToMany(books, {
        as: "books",
        through: authors_books,
        foreignKey: "author_id",
        otherKey: "book_id"
    });
    books.belongsToMany(authors, {
        as: "authors",
        through: authors_books,
        foreignKey: "book_id",
        otherKey: "author_id"
    });
    return {
        races,
        units,
        authors,
        books,
        authors_books
    };
}

export type Models = ReturnType<typeof initModels>;`);
    });

    it('renders the barrel re-exporting every model and initModels', () => {
        expect(renderNativeIndexFile(tablesMetadata)).toBe(
`export * from "./races";
export * from "./units";
export * from "./authors";
export * from "./books";
export * from "./authors_books";
export * from "./initModels";`);
    });

});

describe('renderNativeFiles', () => {

    it('returns one descriptor per model plus initModels and index', () => {
        const files = renderNativeFiles(tablesMetadata, dialect);

        expect(files.map(file => file.fileName)).toEqual([
            'races.ts',
            'units.ts',
            'authors.ts',
            'books.ts',
            'authors_books.ts',
            'initModels.ts',
            'index.ts',
        ]);
        expect(files).toHaveLength(Object.keys(tablesMetadata).length + 2);
    });

    it('renders each model file identically to renderNativeModelFile and wires the same initModels/index content', () => {
        const files = renderNativeFiles(tablesMetadata, dialect);
        const initModels = files.find(file => file.fileName === 'initModels.ts');
        const index = files.find(file => file.fileName === 'index.ts');

        expect(initModels?.content).toBe(renderInitModelsFile(tablesMetadata, tablesByModel));
        expect(index?.content).toBe(renderNativeIndexFile(tablesMetadata));
    });

});
