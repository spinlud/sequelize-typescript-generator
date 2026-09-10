import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsToMany 
} from "sequelize-typescript";
import { books } from "./books";
import { authors_books } from "./authors_books";

export interface authorsAttributes {
	author_id?: number;
	full_name: string;
}

@Table({
	tableName: "authors",
	timestamps: false 
})
export class authors extends Model<authorsAttributes, authorsAttributes> implements authorsAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_authors_1",
		unique: true 
	})
	author_id?: number;

	@Column({
		type: DataType.STRING 
	})
	full_name!: string;

	@BelongsToMany(() => books, () => authors_books)
	books?: books[];

}