import { renderNativeModelFile } from '../../builders/NativeModelRenderer.js';
import { indexTablesByModelName } from '../../builders/nativeAttributes.js';
import { DialectSQLite } from '../../dialects/DialectSQLite.js';
import type { IColumnMetadata, ITableMetadata, ITablesMetadata } from '../../dialects/Dialect.js';
import type { IAssociationMetadata } from '../../dialects/AssociationsParser.js';
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

const employees = buildTable('employees', [
    buildColumn({ name: 'employee_id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'name', type: 'varchar', sequelizeType: dataType('STRING') }),
    buildColumn({
        name: 'manager_id',
        type: 'integer',
        sequelizeType: dataType('INTEGER'),
        allowNull: true,
        foreignKey: { name: 'manager_id', targetModel: 'employees', targetKey: 'employee_id' },
    }),
], {
    associations: [
        { associationName: 'BelongsTo', targetModel: 'employees', alias: 'manager', foreignKey: 'manager_id', onDelete: 'SET NULL' },
        { associationName: 'HasMany', targetModel: 'employees', alias: 'managerEmployees', foreignKey: 'manager_id', sourceKey: 'employee_id', onDelete: 'SET NULL' },
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

const dataTypes = buildTable('data_types', [
    buildColumn({ name: 'id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'f_int', type: 'integer', sequelizeType: dataType('INTEGER'), allowNull: true }),
    buildColumn({ name: 'f_varchar', type: 'varchar', sequelizeType: dataType('STRING'), allowNull: true }),
    buildColumn({ name: 'f_blob', type: 'blob', sequelizeType: dataType('BLOB'), allowNull: true }),
    buildColumn({ name: 'f_enum', type: 'enum', sequelizeType: dataType('ENUM', 'AA', 'BB'), allowNull: true }),
]);

const softDeletes = buildTable('soft_deletes', [
    buildColumn({ name: 'id', type: 'integer', sequelizeType: dataType('INTEGER'), primaryKey: true, autoIncrement: true }),
    buildColumn({ name: 'name', type: 'varchar', sequelizeType: dataType('STRING') }),
    buildColumn({ name: 'deleted_at', type: 'decimal', sequelizeType: dataType('DECIMAL'), allowNull: true }),
], {
    timestamps: true,
    paranoid: true,
    deletedAt: 'deleted_at',
});

const tablesMetadata: ITablesMetadata = {
    races, units, employees, authors, books, authors_books: authorsBooks, data_types: dataTypes, soft_deletes: softDeletes,
};
const tablesByModel = indexTablesByModelName(tablesMetadata);

const render = (table: ITableMetadata): string => renderNativeModelFile(table, dialect, tablesByModel);

describe('NativeModelRenderer', () => {

    it('renders a BelongsTo model (units)', () => {
        expect(render(units)).toBe(
`import { Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import type { races } from "./races";

export class units extends Model<InferAttributes<units>, InferCreationAttributes<units>> {
    declare unit_id: CreationOptional<number>;
    declare unit_name: string;
    declare race_id: ForeignKey<races["race_id"]>;
    declare getRace: BelongsToGetAssociationMixin<races>;
    declare setRace: BelongsToSetAssociationMixin<races, races["race_id"]>;
    declare createRace: BelongsToCreateAssociationMixin<races>;
    declare race?: NonAttribute<races>;
    declare static associations: {
        race: Association<units, races>;
    };
    static initModel(sequelize: Sequelize): typeof units {
        units.init({
            unit_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            unit_name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            race_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            sequelize,
            tableName: "units",
            freezeTableName: true,
            timestamps: false
        });
        return units;
    }
}`);
    });

    it('renders a HasMany model with the full to-many mixin set (races)', () => {
        expect(render(races)).toBe(
`import { Association, CreationOptional, DataTypes, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import type { units } from "./units";

export class races extends Model<InferAttributes<races>, InferCreationAttributes<races>> {
    declare race_id: CreationOptional<number>;
    declare race_name: string;
    declare getUnits: HasManyGetAssociationsMixin<units>;
    declare setUnits: HasManySetAssociationsMixin<units, units["unit_id"]>;
    declare addUnit: HasManyAddAssociationMixin<units, units["unit_id"]>;
    declare addUnits: HasManyAddAssociationsMixin<units, units["unit_id"]>;
    declare removeUnit: HasManyRemoveAssociationMixin<units, units["unit_id"]>;
    declare removeUnits: HasManyRemoveAssociationsMixin<units, units["unit_id"]>;
    declare hasUnit: HasManyHasAssociationMixin<units, units["unit_id"]>;
    declare hasUnits: HasManyHasAssociationsMixin<units, units["unit_id"]>;
    declare countUnits: HasManyCountAssociationsMixin;
    declare createUnit: HasManyCreateAssociationMixin<units, "race_id">;
    declare units?: NonAttribute<units[]>;
    declare static associations: {
        units: Association<races, units>;
    };
    static initModel(sequelize: Sequelize): typeof races {
        races.init({
            race_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            race_name: {
                type: DataTypes.STRING,
                allowNull: false
            }
        }, {
            sequelize,
            tableName: "races",
            freezeTableName: true,
            timestamps: false
        });
        return races;
    }
}`);
    });

    it('renders a self-referential model with no model import (employees)', () => {
        expect(render(employees)).toBe(
`import { Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";

export class employees extends Model<InferAttributes<employees>, InferCreationAttributes<employees>> {
    declare employee_id: CreationOptional<number>;
    declare name: string;
    declare manager_id: ForeignKey<employees["employee_id"] | null>;
    declare getManager: BelongsToGetAssociationMixin<employees>;
    declare setManager: BelongsToSetAssociationMixin<employees, employees["employee_id"]>;
    declare createManager: BelongsToCreateAssociationMixin<employees>;
    declare getManagerEmployees: HasManyGetAssociationsMixin<employees>;
    declare setManagerEmployees: HasManySetAssociationsMixin<employees, employees["employee_id"]>;
    declare addManagerEmployee: HasManyAddAssociationMixin<employees, employees["employee_id"]>;
    declare addManagerEmployees: HasManyAddAssociationsMixin<employees, employees["employee_id"]>;
    declare removeManagerEmployee: HasManyRemoveAssociationMixin<employees, employees["employee_id"]>;
    declare removeManagerEmployees: HasManyRemoveAssociationsMixin<employees, employees["employee_id"]>;
    declare hasManagerEmployee: HasManyHasAssociationMixin<employees, employees["employee_id"]>;
    declare hasManagerEmployees: HasManyHasAssociationsMixin<employees, employees["employee_id"]>;
    declare countManagerEmployees: HasManyCountAssociationsMixin;
    declare createManagerEmployee: HasManyCreateAssociationMixin<employees, "manager_id">;
    declare manager?: NonAttribute<employees>;
    declare managerEmployees?: NonAttribute<employees[]>;
    declare static associations: {
        manager: Association<employees, employees>;
        managerEmployees: Association<employees, employees>;
    };
    static initModel(sequelize: Sequelize): typeof employees {
        employees.init({
            employee_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            manager_id: {
                type: DataTypes.INTEGER,
                allowNull: true
            }
        }, {
            sequelize,
            tableName: "employees",
            freezeTableName: true,
            timestamps: false
        });
        return employees;
    }
}`);
    });

    it('renders a junction model with branded keys and no associations (authors_books)', () => {
        expect(render(authorsBooks)).toBe(
`import { DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";
import type { authors } from "./authors";
import type { books } from "./books";

export class authors_books extends Model<InferAttributes<authors_books>, InferCreationAttributes<authors_books>> {
    declare author_id: ForeignKey<authors["author_id"]>;
    declare book_id: ForeignKey<books["book_id"]>;
    static initModel(sequelize: Sequelize): typeof authors_books {
        authors_books.init({
            author_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            book_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            sequelize,
            tableName: "authors_books",
            freezeTableName: true,
            timestamps: false
        });
        return authors_books;
    }
}`);
    });

    it('renders nullable columns and an enum union (data_types)', () => {
        expect(render(dataTypes)).toBe(
`import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";

export class data_types extends Model<InferAttributes<data_types>, InferCreationAttributes<data_types>> {
    declare id: CreationOptional<number>;
    declare f_int: number | null;
    declare f_varchar: string | null;
    declare f_blob: Uint8Array | null;
    declare f_enum: "AA" | "BB" | null;
    static initModel(sequelize: Sequelize): typeof data_types {
        data_types.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            f_int: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            f_varchar: {
                type: DataTypes.STRING,
                allowNull: true
            },
            f_blob: {
                type: DataTypes.BLOB,
                allowNull: true
            },
            f_enum: {
                type: DataTypes.ENUM("AA", "BB"),
                allowNull: true
            }
        }, {
            sequelize,
            tableName: "data_types",
            freezeTableName: true,
            timestamps: false
        });
        return data_types;
    }
}`);
    });

    it('renders a paranoid model with timestamps (soft_deletes)', () => {
        expect(render(softDeletes)).toBe(
`import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from "sequelize";

export class soft_deletes extends Model<InferAttributes<soft_deletes>, InferCreationAttributes<soft_deletes>> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare deleted_at: CreationOptional<Date | null>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    static initModel(sequelize: Sequelize): typeof soft_deletes {
        soft_deletes.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            deleted_at: {
                type: DataTypes.DECIMAL,
                allowNull: true
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE
        }, {
            sequelize,
            tableName: "soft_deletes",
            freezeTableName: true,
            timestamps: true,
            paranoid: true,
            deletedAt: "deleted_at"
        });
        return soft_deletes;
    }
}`);
    });

});
