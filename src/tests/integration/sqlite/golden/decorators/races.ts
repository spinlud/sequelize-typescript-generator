import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasMany 
} from "sequelize-typescript";
import { units } from "./units";

export interface racesAttributes {
	race_id?: number;
	race_name: string;
}

@Table({
	tableName: "races",
	timestamps: false 
})
export class races extends Model<racesAttributes, racesAttributes> implements racesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_races_1",
		unique: true 
	})
	race_id?: number;

	@Column({
		type: DataType.STRING 
	})
	race_name!: string;

	@HasMany(() => units, {
		sourceKey: "race_id" 
	})
	units?: units[];

}