import {
	Association, BelongsToManyAddAssociationMixin, BelongsToManyAddAssociationsMixin, BelongsToManyCountAssociationsMixin, BelongsToManyCreateAssociationMixin, BelongsToManyGetAssociationsMixin, BelongsToManyHasAssociationMixin, BelongsToManyHasAssociationsMixin, BelongsToManyRemoveAssociationMixin, BelongsToManyRemoveAssociationsMixin, BelongsToManySetAssociationsMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { books } from "./books";

export class authors extends Model<InferAttributes<authors>, InferCreationAttributes<authors>> {

	declare author_id: CreationOptional<number | null>;

	declare full_name: string;

	declare getBooks: BelongsToManyGetAssociationsMixin<books>;

	declare setBooks: BelongsToManySetAssociationsMixin<books, books["book_id"]>;

	declare addBook: BelongsToManyAddAssociationMixin<books, books["book_id"]>;

	declare addBooks: BelongsToManyAddAssociationsMixin<books, books["book_id"]>;

	declare removeBook: BelongsToManyRemoveAssociationMixin<books, books["book_id"]>;

	declare removeBooks: BelongsToManyRemoveAssociationsMixin<books, books["book_id"]>;

	declare hasBook: BelongsToManyHasAssociationMixin<books, books["book_id"]>;

	declare hasBooks: BelongsToManyHasAssociationsMixin<books, books["book_id"]>;

	declare countBooks: BelongsToManyCountAssociationsMixin;

	declare createBook: BelongsToManyCreateAssociationMixin<books>;

	declare books?: NonAttribute<books[]>;

	declare static associations: {
		books: Association<authors, books>;
	};

	static initModel(sequelize: Sequelize): typeof authors {
		authors.init({
			author_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			full_name: {
				type: DataTypes.STRING,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "authors",
			freezeTableName: true,
			timestamps: false
		});
		return authors;
	}

}