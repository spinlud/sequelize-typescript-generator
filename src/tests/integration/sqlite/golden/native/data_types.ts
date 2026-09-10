import {
	CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";

export class data_types extends Model<InferAttributes<data_types>, InferCreationAttributes<data_types>> {

	declare id: CreationOptional<number | null>;

	declare f_int: number | null;

	declare f_integer: number | null;

	declare f_tinyint: number | null;

	declare f_smallint: number | null;

	declare f_mediumint: number | null;

	declare f_bigint: number | null;

	declare f_unsigned_big_int: number | null;

	declare f_int2: number | null;

	declare f_int8: number | null;

	declare f_real: number | null;

	declare f_double: number | null;

	declare f_double_precision: number | null;

	declare f_float: number | null;

	declare f_numeric: number | null;

	declare f_decimal: number | null;

	declare f_date: number | null;

	declare f_datetime: number | null;

	declare f_timestamp: number | null;

	declare f_time: number | null;

	declare f_varchar: string | null;

	declare f_character: string | null;

	declare f_varying_character: string | null;

	declare f_nchar: string | null;

	declare f_native_character: string | null;

	declare f_nvarchar: string | null;

	declare f_text: string | null;

	declare f_clob: string | null;

	declare f_boolean: number | null;

	declare f_blob: Uint8Array | null;

	static initModel(sequelize: Sequelize): typeof data_types {
		data_types.init({
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			f_int: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_integer: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_tinyint: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_smallint: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_mediumint: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_bigint: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_unsigned_big_int: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_int2: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_int8: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_real: {
				type: DataTypes.REAL,
				allowNull: true
			},
			f_double: {
				type: DataTypes.REAL,
				allowNull: true
			},
			f_double_precision: {
				type: DataTypes.REAL,
				allowNull: true
			},
			f_float: {
				type: DataTypes.REAL,
				allowNull: true
			},
			f_numeric: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_decimal: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_date: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_datetime: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_timestamp: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_time: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_varchar: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_character: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_varying_character: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_nchar: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_native_character: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_nvarchar: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_text: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_clob: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_boolean: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			f_blob: {
				type: DataTypes.BLOB,
				allowNull: true
			}
		}, {
			sequelize,
			tableName: "data_types",
			freezeTableName: true,
			timestamps: false
		});
		return data_types;
	}

}