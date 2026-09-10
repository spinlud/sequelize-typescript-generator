import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { races } from "./races";

export class units extends Model<InferAttributes<units>, InferCreationAttributes<units>> {

	declare unit_id: CreationOptional<number | null>;

	declare unit_name: string;

	declare race_id: ForeignKey<races["race_id"]>;

	declare getRace: BelongsToGetAssociationMixin<races>;

	declare setRace: BelongsToSetAssociationMixin<races, races["race_id"]>;

	declare createRace: BelongsToCreateAssociationMixin<races>;

	declare race?: NonAttribute<races>;

	declare static associations: {
		race: Association<units, races>;
	};

	static initModel(sequelize: Sequelize): typeof units {
		units.init({
			unit_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			unit_name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			race_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "units",
			freezeTableName: true,
			timestamps: false
		});
		return units;
	}

}