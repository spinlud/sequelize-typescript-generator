import {
	Association, BelongsToManyAddAssociationMixin, BelongsToManyAddAssociationsMixin, BelongsToManyCountAssociationsMixin, BelongsToManyCreateAssociationMixin, BelongsToManyGetAssociationsMixin, BelongsToManyHasAssociationMixin, BelongsToManyHasAssociationsMixin, BelongsToManyRemoveAssociationMixin, BelongsToManyRemoveAssociationsMixin, BelongsToManySetAssociationsMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { authors } from "./authors";

export class books extends Model<InferAttributes<books>, InferCreationAttributes<books>> {

	declare book_id: CreationOptional<number | null>;

	declare title: string;

	declare getAuthors: BelongsToManyGetAssociationsMixin<authors>;

	declare setAuthors: BelongsToManySetAssociationsMixin<authors, authors["author_id"]>;

	declare addAuthor: BelongsToManyAddAssociationMixin<authors, authors["author_id"]>;

	declare addAuthors: BelongsToManyAddAssociationsMixin<authors, authors["author_id"]>;

	declare removeAuthor: BelongsToManyRemoveAssociationMixin<authors, authors["author_id"]>;

	declare removeAuthors: BelongsToManyRemoveAssociationsMixin<authors, authors["author_id"]>;

	declare hasAuthor: BelongsToManyHasAssociationMixin<authors, authors["author_id"]>;

	declare hasAuthors: BelongsToManyHasAssociationsMixin<authors, authors["author_id"]>;

	declare countAuthors: BelongsToManyCountAssociationsMixin;

	declare createAuthor: BelongsToManyCreateAssociationMixin<authors>;

	declare authors?: NonAttribute<authors[]>;

	declare static associations: {
		authors: Association<books, authors>;
	};

	static initModel(sequelize: Sequelize): typeof books {
		books.init({
			book_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			title: {
				type: DataTypes.STRING,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "books",
			freezeTableName: true,
			timestamps: false
		});
		return books;
	}

}