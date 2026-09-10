import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface employeesAttributes {
	employee_id?: number;
	name?: string;
	manager_id: number;
}

@Table({
	tableName: "employees",
	timestamps: false 
})
export class employees extends Model<employeesAttributes, employeesAttributes> implements employeesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_employees_1",
		unique: true 
	})
	employee_id?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	name?: string;

	@ForeignKey(() => employees)
	@Column({
		type: DataType.INTEGER 
	})
	manager_id!: number;

}