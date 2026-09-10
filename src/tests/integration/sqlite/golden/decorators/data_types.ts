import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";

export interface data_typesAttributes {
	id?: number;
	f_int?: number;
	f_integer?: number;
	f_tinyint?: number;
	f_smallint?: number;
	f_mediumint?: number;
	f_bigint?: number;
	f_unsigned_big_int?: number;
	f_int2?: number;
	f_int8?: number;
	f_real?: number;
	f_double?: number;
	f_double_precision?: number;
	f_float?: number;
	f_numeric?: number;
	f_decimal?: number;
	f_date?: number;
	f_datetime?: number;
	f_timestamp?: number;
	f_time?: number;
	f_varchar?: string;
	f_character?: string;
	f_varying_character?: string;
	f_nchar?: string;
	f_native_character?: string;
	f_nvarchar?: string;
	f_text?: string;
	f_clob?: string;
	f_boolean?: number;
	f_blob?: Uint8Array;
}

@Table({
	tableName: "data_types",
	timestamps: false 
})
export class data_types extends Model<data_typesAttributes, data_typesAttributes> implements data_typesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	id?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_int?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_integer?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_tinyint?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_smallint?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_mediumint?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_bigint?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_unsigned_big_int?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_int2?: number;

	@Column({
		allowNull: true,
		type: DataType.INTEGER 
	})
	f_int8?: number;

	@Column({
		allowNull: true,
		type: DataType.REAL 
	})
	f_real?: number;

	@Column({
		allowNull: true,
		type: DataType.REAL 
	})
	f_double?: number;

	@Column({
		allowNull: true,
		type: DataType.REAL 
	})
	f_double_precision?: number;

	@Column({
		allowNull: true,
		type: DataType.REAL 
	})
	f_float?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_numeric?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_decimal?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_date?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_datetime?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_timestamp?: number;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_time?: number;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_varchar?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_character?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_varying_character?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_nchar?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_native_character?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_nvarchar?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_text?: string;

	@Column({
		allowNull: true,
		type: DataType.STRING 
	})
	f_clob?: string;

	@Column({
		allowNull: true,
		type: DataType.DECIMAL 
	})
	f_boolean?: number;

	@Column({
		allowNull: true,
		type: DataType.BLOB 
	})
	f_blob?: Uint8Array;

}