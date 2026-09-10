import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface soft_deletesAttributes {
	id?: number;
	name?: string;
	deleted_at: number;
}

@Table({
	tableName: "soft_deletes",
	timestamps: false 
})
export class soft_deletes extends Model<soft_deletesAttributes, soft_deletesAttributes> implements soft_deletesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_soft_deletes_1",
		unique: true 
	})
	id?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	name?: string;

	@Column({
		type: DataType.DECIMAL 
	})
	deleted_at!: number;

}