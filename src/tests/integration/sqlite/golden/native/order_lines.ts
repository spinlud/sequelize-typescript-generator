import {
	CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";

export class order_lines extends Model<InferAttributes<order_lines>, InferCreationAttributes<order_lines>> {

	declare order_line_id: CreationOptional<number | null>;

	declare order_id: number;

	declare line_no: number;

	static initModel(sequelize: Sequelize): typeof order_lines {
		order_lines.init({
			order_line_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			order_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			},
			line_no: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "order_lines",
			freezeTableName: true,
			timestamps: false,
			indexes: [
				{
					name: "sqlite_autoindex_order_lines_2",
					unique: true,
					fields: [
						"order_id",
						"line_no"
					]
				}
			]
		});
		return order_lines;
	}

}