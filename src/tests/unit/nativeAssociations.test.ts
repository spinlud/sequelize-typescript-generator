import {
    buildAssociationMixinDeclarations,
    collectModelTypeImports,
    collectSequelizeImports,
    IMixinDeclaration,
    resolveAssociationForeignKey,
    resolveAssociationWiring,
} from '../../builders/nativeAssociations.js';
import { indexTablesByModelName } from '../../builders/nativeAttributes.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { IAssociationMetadata } from '../../dialects/AssociationsParser.js';

const buildColumn = (overrides: Partial<IColumnMetadata> & Pick<IColumnMetadata, 'name'>): IColumnMetadata => ({
    originName: overrides.name,
    type: 'int',
    typeExt: 'int',
    primaryKey: false,
    allowNull: false,
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
    timestamps: false,
    columns: Object.fromEntries(columns.map(column => [column.name, column])),
    associations,
});

const races = buildTable('races', [
    buildColumn({ name: 'race_id', primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'race_name' }),
], [
    { associationName: 'HasMany', targetModel: 'units', alias: 'units', foreignKey: 'race_id', sourceKey: 'race_id' },
]);

const units = buildTable('units', [
    buildColumn({ name: 'unit_id', primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'unit_name' }),
    buildColumn({ name: 'race_id', foreignKey: { name: 'race_id', targetModel: 'races', targetKey: 'race_id' } }),
], [
    { associationName: 'BelongsTo', targetModel: 'races', alias: 'race' },
]);

const employees = buildTable('employees', [
    buildColumn({ name: 'employee_id', primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'name' }),
    buildColumn({
        name: 'manager_id',
        allowNull: true,
        foreignKey: { name: 'manager_id', targetModel: 'employees', targetKey: 'employee_id' },
    }),
], [
    { associationName: 'BelongsTo', targetModel: 'employees', alias: 'manager', foreignKey: 'manager_id', onDelete: 'SET NULL' },
    { associationName: 'HasMany', targetModel: 'employees', alias: 'managerEmployees', foreignKey: 'manager_id', sourceKey: 'employee_id', onDelete: 'SET NULL' },
]);

const authors = buildTable('authors', [
    buildColumn({ name: 'author_id', primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'name' }),
], [
    { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books', alias: 'books' },
]);

const books = buildTable('books', [
    buildColumn({ name: 'book_id', primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'title' }),
], [
    { associationName: 'BelongsToMany', targetModel: 'authors', joinModel: 'authors_books', alias: 'authors' },
]);

const authorsBooks = buildTable('authors_books', [
    buildColumn({ name: 'author_id', primaryKey: true, foreignKey: { name: 'author_id', targetModel: 'authors', targetKey: 'author_id' } }),
    buildColumn({ name: 'book_id', primaryKey: true, foreignKey: { name: 'book_id', targetModel: 'books', targetKey: 'book_id' } }),
]);

const tablesMetadata: ITablesMetadata = { races, units, employees, authors, books, authors_books: authorsBooks };
const tablesByModel = indexTablesByModelName(tablesMetadata);

describe('nativeAssociations', () => {

    describe('resolveAssociationForeignKey', () => {
        it('returns the discovered foreign key directly', () => {
            expect(resolveAssociationForeignKey(races, races.associations![0], tablesByModel)).toBe('race_id');
        });

        it('resolves a BelongsTo foreign key from the source column', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'races' };
            expect(resolveAssociationForeignKey(units, association, tablesByModel)).toBe('race_id');
        });

        it('resolves a HasMany foreign key from the target column', () => {
            const association: IAssociationMetadata = { associationName: 'HasMany', targetModel: 'units' };
            expect(resolveAssociationForeignKey(races, association, tablesByModel)).toBe('race_id');
        });

        it('resolves a BelongsToMany foreign key from the junction column pointing at the source', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books' };
            expect(resolveAssociationForeignKey(authors, association, tablesByModel)).toBe('author_id');
        });
    });

    describe('resolveAssociationWiring', () => {
        it('resolves a BelongsTo call with a target key derived from the source column', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'races', alias: 'race' };
            const wiring = resolveAssociationWiring(units, association, tablesByModel);

            expect(wiring.method).toBe('belongsTo');
            expect(wiring.sourceModel).toBe('units');
            expect(wiring.targetModel).toBe('races');
            expect(wiring.options).toEqual({ as: 'race', foreignKey: 'race_id', targetKey: 'race_id' });
            expect(Object.keys(wiring.options)).toEqual(['as', 'foreignKey', 'targetKey']);
        });

        it('resolves a HasMany call with foreignKey and sourceKey', () => {
            const wiring = resolveAssociationWiring(races, races.associations![0], tablesByModel);

            expect(wiring.method).toBe('hasMany');
            expect(wiring.options).toEqual({ as: 'units', foreignKey: 'race_id', sourceKey: 'race_id' });
            expect(Object.keys(wiring.options)).toEqual(['as', 'foreignKey', 'sourceKey']);
        });

        it('emits onDelete and keeps the fixed option order for a self-referential BelongsTo', () => {
            const wiring = resolveAssociationWiring(employees, employees.associations![0], tablesByModel);

            expect(wiring.options).toEqual({ as: 'manager', foreignKey: 'manager_id', targetKey: 'employee_id', onDelete: 'SET NULL' });
            expect(Object.keys(wiring.options)).toEqual(['as', 'foreignKey', 'targetKey', 'onDelete']);
        });

        it('resolves a BelongsToMany call with through, foreignKey and otherKey', () => {
            const wiring = resolveAssociationWiring(authors, authors.associations![0], tablesByModel);

            expect(wiring.method).toBe('belongsToMany');
            expect(wiring.options).toEqual({ as: 'books', throughModel: 'authors_books', foreignKey: 'author_id', otherKey: 'book_id' });
            expect(Object.keys(wiring.options)).toEqual(['as', 'throughModel', 'foreignKey', 'otherKey']);
        });
    });

    describe('buildAssociationMixinDeclarations', () => {
        it('builds get/set/create mixins for a BelongsTo association', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'races', alias: 'race' };

            expect(buildAssociationMixinDeclarations(association, 'race', 'race_id', 'race_id')).toEqual([
                { propertyName: 'getRace', mixinTypeName: 'BelongsToGetAssociationMixin', typeArguments: [{ kind: 'model', name: 'races' }] },
                { propertyName: 'setRace', mixinTypeName: 'BelongsToSetAssociationMixin', typeArguments: [{ kind: 'model', name: 'races' }, { kind: 'attribute', model: 'races', attribute: 'race_id' }] },
                { propertyName: 'createRace', mixinTypeName: 'BelongsToCreateAssociationMixin', typeArguments: [{ kind: 'model', name: 'races' }] },
            ] satisfies IMixinDeclaration[]);
        });

        it('falls back to a number primary key type when the target has none', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsTo', targetModel: 'races', alias: 'race' };
            const declarations = buildAssociationMixinDeclarations(association, 'race', undefined, 'race_id');

            expect(declarations[1].typeArguments[1]).toEqual({ kind: 'number' });
        });

        it('builds the full to-many mixin set with singular and plural names for a HasMany', () => {
            const association: IAssociationMetadata = { associationName: 'HasMany', targetModel: 'units', alias: 'units' };
            const declarations = buildAssociationMixinDeclarations(association, 'units', 'unit_id', 'race_id');

            expect(declarations.map(declaration => declaration.propertyName)).toEqual([
                'getUnits', 'setUnits', 'addUnit', 'addUnits', 'removeUnit', 'removeUnits',
                'hasUnit', 'hasUnits', 'countUnits', 'createUnit',
            ]);
            expect(declarations.map(declaration => declaration.mixinTypeName)).toEqual([
                'HasManyGetAssociationsMixin', 'HasManySetAssociationsMixin', 'HasManyAddAssociationMixin',
                'HasManyAddAssociationsMixin', 'HasManyRemoveAssociationMixin', 'HasManyRemoveAssociationsMixin',
                'HasManyHasAssociationMixin', 'HasManyHasAssociationsMixin', 'HasManyCountAssociationsMixin',
                'HasManyCreateAssociationMixin',
            ]);

            const create = declarations[declarations.length - 1];
            expect(create.typeArguments).toEqual([{ kind: 'model', name: 'units' }, { kind: 'literal', value: 'race_id' }]);

            const count = declarations[8];
            expect(count.typeArguments).toEqual([]);
        });

        it('builds BelongsToMany mixins with a target-only create mixin', () => {
            const association: IAssociationMetadata = { associationName: 'BelongsToMany', targetModel: 'books', joinModel: 'authors_books', alias: 'books' };
            const declarations = buildAssociationMixinDeclarations(association, 'books', 'book_id', undefined);

            expect(declarations.map(declaration => declaration.propertyName)).toEqual([
                'getBooks', 'setBooks', 'addBook', 'addBooks', 'removeBook', 'removeBooks',
                'hasBook', 'hasBooks', 'countBooks', 'createBook',
            ]);

            const create = declarations[declarations.length - 1];
            expect(create.mixinTypeName).toBe('BelongsToManyCreateAssociationMixin');
            expect(create.typeArguments).toEqual([{ kind: 'model', name: 'books' }]);
        });
    });

    describe('collectSequelizeImports', () => {
        it('collects base imports, brands, Association and mixins for a model with a foreign key and association', () => {
            expect(collectSequelizeImports(units, tablesByModel)).toEqual([
                'Association',
                'BelongsToCreateAssociationMixin',
                'BelongsToGetAssociationMixin',
                'BelongsToSetAssociationMixin',
                'CreationOptional',
                'DataTypes',
                'ForeignKey',
                'InferAttributes',
                'InferCreationAttributes',
                'Model',
                'NonAttribute',
                'Sequelize',
            ]);
        });

        it('collects only the base set plus ForeignKey for a junction without associations', () => {
            expect(collectSequelizeImports(authorsBooks, tablesByModel)).toEqual([
                'DataTypes',
                'ForeignKey',
                'InferAttributes',
                'InferCreationAttributes',
                'Model',
                'Sequelize',
            ]);
        });
    });

    describe('collectModelTypeImports', () => {
        it('imports the foreign key and association targets of a model', () => {
            expect(collectModelTypeImports(units, tablesByModel)).toEqual(['races']);
        });

        it('imports both junction foreign key targets', () => {
            expect(collectModelTypeImports(authorsBooks, tablesByModel)).toEqual(['authors', 'books']);
        });

        it('imports the association target but not the junction for a BelongsToMany source', () => {
            expect(collectModelTypeImports(authors, tablesByModel)).toEqual(['books']);
        });

        it('imports nothing for a purely self-referential model', () => {
            expect(collectModelTypeImports(employees, tablesByModel)).toEqual([]);
        });
    });

});
