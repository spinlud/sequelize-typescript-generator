import { Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import { Authors } from "./Authors";

export class Books extends Model<InferAttributes<Books>, InferCreationAttributes<Books>> {
    declare id: CreationOptional<number>;
    declare title: string;
    declare subtitle: string | null;
    declare author_id: ForeignKey<Authors["id"]>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    declare getAuthor: BelongsToGetAssociationMixin<Authors>;
    declare setAuthor: BelongsToSetAssociationMixin<Authors, number>;
    declare createAuthor: BelongsToCreateAssociationMixin<Authors>;
    declare author?: NonAttribute<Authors>;
    declare static associations: {
        author: Association<Books, Authors>;
    };
    static initModel(sequelize: Sequelize): typeof Books {
        Books.init({
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            subtitle: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            author_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "authors",
                    key: "id"
                }
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: "created_at"
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: "updated_at"
            }
        }, {
            sequelize,
            tableName: "books",
            timestamps: true,
            indexes: [
                {
                    name: "books_title_idx",
                    fields: ["title"]
                }
            ]
        });
        return Books;
    }
}
