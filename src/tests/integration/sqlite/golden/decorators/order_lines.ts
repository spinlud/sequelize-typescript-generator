import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface order_linesAttributes {
	order_line_id?: number;
	order_id?: number;
	line_no?: number;
}

@Table({
	tableName: "order_lines",
	timestamps: false 
})
export class order_lines extends Model<order_linesAttributes, order_linesAttributes> implements order_linesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_order_lines_1",
		unique: true 
	})
	order_line_id?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_order_lines_2",
		unique: true 
	})
	order_id?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_order_lines_2",
		unique: true 
	})
	line_no?: number;

}