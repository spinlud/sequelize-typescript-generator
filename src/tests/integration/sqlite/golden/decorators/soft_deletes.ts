import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface soft_deletesAttributes {
	id?: number;
	name: string;
	createdAt?: number;
	updatedAt?: number;
	deleted_at?: number;
}

@Table({
	tableName: "soft_deletes",
	timestamps: false 
})
export class soft_deletes extends Model<soft_deletesAttributes, soft_deletesAttributes> implements soft_deletesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_soft_deletes_1",
		unique: true 
	})
	id?: number;

	@Column({
		type: DataType.STRING 
	})
	name!: string;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	createdAt?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	updatedAt?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	deleted_at?: number;

}