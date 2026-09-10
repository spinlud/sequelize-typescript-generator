import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface shipmentsAttributes {
	shipment_id?: number;
	order_id: number;
	line_no: number;
}

@Table({
	tableName: "shipments",
	timestamps: false 
})
export class shipments extends Model<shipmentsAttributes, shipmentsAttributes> implements shipmentsAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_shipments_1",
		unique: true 
	})
	shipment_id?: number;

	@Column({
		type: DataType.INTEGER 
	})
	order_id!: number;

	@Column({
		type: DataType.INTEGER 
	})
	line_no!: number;

}