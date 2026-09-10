import {
	DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";
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

}