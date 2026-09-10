import {
	CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";

export class indices extends Model<InferAttributes<indices>, InferCreationAttributes<indices>> {

	declare id: CreationOptional<number | null>;

	declare f_unique: number;

	declare f_multi_1: number | null;

	declare f_multi_2: string | null;

	declare f_not_unique: number | null;

	static initModel(sequelize: Sequelize): typeof indices {
		indices.init({
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			f_unique: {
				type: DataTypes.INTEGER,
				allowNull: false
			},
			f_multi_1: {
				type: DataTypes.INTEGER,
				allowNull: true
			},
			f_multi_2: {
				type: DataTypes.STRING,
				allowNull: true
			},
			f_not_unique: {
				type: DataTypes.INTEGER,
				allowNull: true
			}
		}, {
			sequelize,
			tableName: "indices",
			freezeTableName: true,
			timestamps: false,
			indexes: [
				{
					name: "indices_f_unique_uindex",
					unique: true,
					fields: [
						"f_unique"
					]
				},
				{
					name: "indices_f_multi_1_uindex",
					unique: true,
					fields: [
						"f_multi_1"
					]
				},
				{
					name: "indices_f_multi_1_f_multi_2_uindex",
					unique: true,
					fields: [
						"f_multi_1",
						"f_multi_2"
					]
				},
				{
					name: "indices_f_not_unique_index",
					unique: false,
					fields: [
						"f_not_unique"
					]
				}
			]
		});
		return indices;
	}

}