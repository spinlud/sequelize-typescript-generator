import { ITableMetadata, IColumnMetadata } from '../dialects/Dialect';
import { IAssociationMetadata } from '../dialects/AssociationsParser';

// The repo's IColumnMetadata.foreignKey only carries { name, targetModel }. A native
// emitter that renders `references: { model, key }` in Model.init needs the referenced
// table name and column too. This extension supplies them for the prototype; the real
// emitter must add these fields to the metadata pipeline (documented gap in README).
export interface INativeForeignKey {
    name: string;
    targetModel: string;
    targetTable: string;
    targetKey: string;
}

// The repo's IAssociationMetadata carries associationName, targetModel and sourceKey.
// Native wiring also needs the concrete foreignKey column and (for BelongsTo) the
// targetKey. These are supplied here; the real emitter must derive them from the
// foreign-key metadata (documented gap in README).
export type INativeAssociationMetadata = IAssociationMetadata & {
    foreignKey: string;
    targetKey?: string;
};

export type INativeColumnMetadata = Omit<IColumnMetadata, 'foreignKey'> & {
    foreignKey?: INativeForeignKey;
};

export type INativeTableMetadata = Omit<ITableMetadata, 'columns' | 'associations'> & {
    columns: { [name: string]: INativeColumnMetadata };
    associations?: INativeAssociationMetadata[];
};

const authors: INativeTableMetadata = {
    name: 'Authors',
    originName: 'authors',
    timestamps: false,
    columns: {
        id: {
            name: 'id',
            originName: 'id',
            type: 'INTEGER',
            typeExt: 'integer',
            dataType: 'DataTypes.INTEGER',
            primaryKey: true,
            allowNull: false,
            autoIncrement: true,
        },
        name: {
            name: 'name',
            originName: 'name',
            type: 'VARCHAR',
            typeExt: 'varchar(255)',
            dataType: 'DataTypes.STRING(255)',
            primaryKey: false,
            allowNull: false,
            autoIncrement: false,
        },
    },
    associations: [
        {
            associationName: 'HasMany',
            targetModel: 'Books',
            sourceKey: 'id',
            foreignKey: 'author_id',
        },
    ],
};

const books: INativeTableMetadata = {
    name: 'Books',
    originName: 'books',
    timestamps: true,
    columns: {
        id: {
            name: 'id',
            originName: 'id',
            type: 'INTEGER',
            typeExt: 'integer',
            dataType: 'DataTypes.INTEGER',
            primaryKey: true,
            allowNull: false,
            autoIncrement: true,
        },
        title: {
            name: 'title',
            originName: 'title',
            type: 'VARCHAR',
            typeExt: 'varchar(255)',
            dataType: 'DataTypes.STRING(255)',
            primaryKey: false,
            allowNull: false,
            autoIncrement: false,
            indices: [
                {
                    name: 'books_title_idx',
                    unique: false,
                },
            ],
        },
        subtitle: {
            name: 'subtitle',
            originName: 'subtitle',
            type: 'VARCHAR',
            typeExt: 'varchar(255)',
            dataType: 'DataTypes.STRING(255)',
            primaryKey: false,
            allowNull: true,
            autoIncrement: false,
        },
        author_id: {
            name: 'author_id',
            originName: 'author_id',
            type: 'INTEGER',
            typeExt: 'integer',
            dataType: 'DataTypes.INTEGER',
            primaryKey: false,
            allowNull: false,
            autoIncrement: false,
            foreignKey: {
                name: 'author_id',
                targetModel: 'Authors',
                targetTable: 'authors',
                targetKey: 'id',
            },
        },
        createdAt: {
            name: 'createdAt',
            originName: 'created_at',
            type: 'TIMESTAMP',
            typeExt: 'timestamp',
            dataType: 'DataTypes.DATE',
            primaryKey: false,
            allowNull: false,
            autoIncrement: false,
            defaultValue: 'CURRENT_TIMESTAMP',
        },
        updatedAt: {
            name: 'updatedAt',
            originName: 'updated_at',
            type: 'TIMESTAMP',
            typeExt: 'timestamp',
            dataType: 'DataTypes.DATE',
            primaryKey: false,
            allowNull: false,
            autoIncrement: false,
            defaultValue: 'CURRENT_TIMESTAMP',
        },
    },
    associations: [
        {
            associationName: 'BelongsTo',
            targetModel: 'Authors',
            foreignKey: 'author_id',
            targetKey: 'id',
        },
    ],
};

// Hand-written metadata for the two prototype tables, keyed by model name.
export const fixtureTables: { [name: string]: INativeTableMetadata } = {
    Authors: authors,
    Books: books,
};
