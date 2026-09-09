import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface indicesAttributes {
	id?: number;
	f_unique?: number;
	f_multi_1: number;
	f_multi_2: string;
	f_not_unique: number;
}

@Table({
	tableName: "indices",
	timestamps: false 
})
export class indices extends Model<indicesAttributes, indicesAttributes> implements indicesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	id?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "indices_f_unique_uindex",
		unique: true 
	})
	f_unique?: number;

	@Column({
		type: DataType.INTEGER 
	})
	@Index({
		name: "indices_f_multi_1_uindex",
		unique: true 
	})
	@Index({
		name: "indices_f_multi_1_f_multi_2_uindex",
		unique: true 
	})
	f_multi_1!: number;

	@Column({
		type: DataType.STRING 
	})
	@Index({
		name: "indices_f_multi_1_f_multi_2_uindex",
		unique: true 
	})
	f_multi_2!: string;

	@Column({
		type: DataType.INTEGER 
	})
	@Index({
		name: "indices_f_not_unique_index",
		unique: false 
	})
	f_not_unique!: number;

}