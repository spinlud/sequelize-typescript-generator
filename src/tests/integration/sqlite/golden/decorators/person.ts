import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasOne 
} from "sequelize-typescript";
import { passport } from "./passport";

export interface personAttributes {
	person_id?: number;
	name?: string;
	passport_id?: number;
}

@Table({
	tableName: "person",
	timestamps: false 
})
export class person extends Model<personAttributes, personAttributes> implements personAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_person_1",
		unique: true 
	})
	person_id?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	name?: string;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	passport_id?: number;

	@HasOne(() => passport, {
		sourceKey: "passport_id" 
	})
	passport?: passport;

}