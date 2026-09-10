import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasOne 
} from "sequelize-typescript";
import { profiles } from "./profiles";
import { passport } from "./passport";

export interface personAttributes {
	person_id?: number;
	name: string;
	passport_id: number;
}

@Table({
	tableName: "person",
	timestamps: false 
})
export class person extends Model<personAttributes, personAttributes> implements personAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_person_1",
		unique: true 
	})
	person_id?: number;

	@Column({
		type: DataType.STRING 
	})
	name!: string;

	@Column({
		type: DataType.INTEGER 
	})
	passport_id!: number;

	@HasOne(() => profiles, {
		as: "profile",
		foreignKey: "person_id",
		sourceKey: "person_id",
		onDelete: "CASCADE",
		onUpdate: "CASCADE" 
	})
	profile?: profiles;

	@HasOne(() => passport, {
		sourceKey: "passport_id" 
	})
	passport?: passport;

}