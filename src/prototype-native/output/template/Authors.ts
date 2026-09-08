import { Association, CreationOptional, DataTypes, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import { Books } from "./Books";

export class Authors extends Model<InferAttributes<Authors>, InferCreationAttributes<Authors>> {
    declare id: CreationOptional<number>;
    declare name: string;
    declare getBooks: HasManyGetAssociationsMixin<Books>;
    declare setBooks: HasManySetAssociationsMixin<Books, number>;
    declare addBook: HasManyAddAssociationMixin<Books, number>;
    declare addBooks: HasManyAddAssociationsMixin<Books, number>;
    declare removeBook: HasManyRemoveAssociationMixin<Books, number>;
    declare removeBooks: HasManyRemoveAssociationsMixin<Books, number>;
    declare hasBook: HasManyHasAssociationMixin<Books, number>;
    declare hasBooks: HasManyHasAssociationsMixin<Books, number>;
    declare countBooks: HasManyCountAssociationsMixin;
    declare createBook: HasManyCreateAssociationMixin<Books>;
    declare books?: NonAttribute<Books[]>;
    declare static associations: {
        books: Association<Authors, Books>;
    };
    static initModel(sequelize: Sequelize): typeof Authors {
        Authors.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false
            }
        }, {
            sequelize,
            tableName: "authors",
            timestamps: false
        });
        return Authors;
    }
}
