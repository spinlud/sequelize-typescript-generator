import {
	CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";

export class shipments extends Model<InferAttributes<shipments>, InferCreationAttributes<shipments>> {

	declare shipment_id: CreationOptional<number | null>;

	declare order_id: number;

	declare line_no: number;

	static initModel(sequelize: Sequelize): typeof shipments {
		shipments.init({
			shipment_id: {
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
			tableName: "shipments",
			freezeTableName: true,
			timestamps: false
		});
		return shipments;
	}

}