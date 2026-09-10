import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsToMany 
} from "sequelize-typescript";
import { authors } from "./authors";
import { authors_books } from "./authors_books";

export interface booksAttributes {
	book_id?: number;
	title: string;
}

@Table({
	tableName: "books",
	timestamps: false 
})
export class books extends Model<booksAttributes, booksAttributes> implements booksAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_books_1",
		unique: true 
	})
	book_id?: number;

	@Column({
		type: DataType.STRING 
	})
	title!: string;

	@BelongsToMany(() => authors, () => authors_books)
	authors?: authors[];

}