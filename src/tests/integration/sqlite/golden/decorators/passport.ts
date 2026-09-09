import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo 
} from "sequelize-typescript";
import { person } from "./person";

export interface passportAttributes {
	passport_id?: number;
	code?: string;
}

@Table({
	tableName: "passport",
	timestamps: false 
})
export class passport extends Model<passportAttributes, passportAttributes> implements passportAttributes {

	@ForeignKey(() => person)
	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_passport_1",
		unique: true 
	})
	passport_id?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	code?: string;

	@BelongsTo(() => person)
	person?: person;

}