import {
	Association, CreationOptional, DataTypes, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { units } from "./units";

export class races extends Model<InferAttributes<races>, InferCreationAttributes<races>> {

	declare race_id: CreationOptional<number | null>;

	declare race_name: string;

	declare getUnits: HasManyGetAssociationsMixin<units>;

	declare setUnits: HasManySetAssociationsMixin<units, units["unit_id"]>;

	declare addUnit: HasManyAddAssociationMixin<units, units["unit_id"]>;

	declare addUnits: HasManyAddAssociationsMixin<units, units["unit_id"]>;

	declare removeUnit: HasManyRemoveAssociationMixin<units, units["unit_id"]>;

	declare removeUnits: HasManyRemoveAssociationsMixin<units, units["unit_id"]>;

	declare hasUnit: HasManyHasAssociationMixin<units, units["unit_id"]>;

	declare hasUnits: HasManyHasAssociationsMixin<units, units["unit_id"]>;

	declare countUnits: HasManyCountAssociationsMixin;

	declare createUnit: HasManyCreateAssociationMixin<units, "race_id">;

	declare units?: NonAttribute<units[]>;

	declare static associations: {
		units: Association<races, units>;
	};

	static initModel(sequelize: Sequelize): typeof races {
		races.init({
			race_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			race_name: {
				type: DataTypes.STRING,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "races",
			freezeTableName: true,
			timestamps: false
		});
		return races;
	}

}