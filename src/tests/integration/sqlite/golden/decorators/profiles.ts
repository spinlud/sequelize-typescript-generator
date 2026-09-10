import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo 
} from "sequelize-typescript";
import { person } from "./person";

export interface profilesAttributes {
	profile_id?: number;
	person_id?: number;
}

@Table({
	tableName: "profiles",
	timestamps: false 
})
export class profiles extends Model<profilesAttributes, profilesAttributes> implements profilesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_profiles_1",
		unique: true 
	})
	profile_id?: number;

	@ForeignKey(() => person)
	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_profiles_2",
		unique: true 
	})
	person_id?: number;

	@BelongsTo(() => person, {
		as: "person",
		foreignKey: "person_id",
		targetKey: "person_id",
		onDelete: "CASCADE",
		onUpdate: "CASCADE" 
	})
	person?: person;

}