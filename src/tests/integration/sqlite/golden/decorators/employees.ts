import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo, HasMany 
} from "sequelize-typescript";

export interface employeesAttributes {
	employee_id?: number;
	name: string;
	manager_id?: number;
}

@Table({
	tableName: "employees",
	timestamps: false 
})
export class employees extends Model<employeesAttributes, employeesAttributes> implements employeesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_employees_1",
		unique: true 
	})
	employee_id?: number;

	@Column({
		type: DataType.STRING 
	})
	name!: string;

	@ForeignKey(() => employees)
	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	manager_id?: number;

	@BelongsTo(() => employees, {
		as: "manager",
		foreignKey: "manager_id",
		targetKey: "employee_id",
		onDelete: "SET NULL" 
	})
	manager?: employees;

	@HasMany(() => employees, {
		as: "managerEmployees",
		foreignKey: "manager_id",
		sourceKey: "employee_id",
		onDelete: "SET NULL" 
	})
	managerEmployees?: employees[];

}