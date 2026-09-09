import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo 
} from "sequelize-typescript";
import { races } from "./races";

export interface unitsAttributes {
	unit_id?: number;
	unit_name?: string;
	race_id?: number;
}

@Table({
	tableName: "units",
	timestamps: false 
})
export class units extends Model<unitsAttributes, unitsAttributes> implements unitsAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_units_1",
		unique: true 
	})
	unit_id?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	unit_name?: string;

	@ForeignKey(() => races)
	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	race_id?: number;

	@BelongsTo(() => races)
	race?: races;

}