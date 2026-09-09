import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";
import { authors } from "./authors";
import { books } from "./books";

export interface authors_booksAttributes {
	author_id?: number;
	book_id?: number;
}

@Table({
	tableName: "authors_books",
	timestamps: false 
})
export class authors_books extends Model<authors_booksAttributes, authors_booksAttributes> implements authors_booksAttributes {

	@ForeignKey(() => authors)
	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	author_id?: number;

	@ForeignKey(() => books)
	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	book_id?: number;

}