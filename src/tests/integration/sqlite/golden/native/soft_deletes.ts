import {
	CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";

export class soft_deletes extends Model<InferAttributes<soft_deletes>, InferCreationAttributes<soft_deletes>> {

	declare id: CreationOptional<number | null>;

	declare name: string;

	declare createdAt: number | null;

	declare updatedAt: number | null;

	declare deleted_at: number | null;

	static initModel(sequelize: Sequelize): typeof soft_deletes {
		soft_deletes.init({
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			createdAt: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			updatedAt: {
				type: DataTypes.DECIMAL,
				allowNull: true
			},
			deleted_at: {
				type: DataTypes.DECIMAL,
				allowNull: true
			}
		}, {
			sequelize,
			tableName: "soft_deletes",
			freezeTableName: true,
			timestamps: false
		});
		return soft_deletes;
	}

}