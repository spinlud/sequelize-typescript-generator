import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { person } from "./person";

export class profiles extends Model<InferAttributes<profiles>, InferCreationAttributes<profiles>> {

	declare profile_id: CreationOptional<number | null>;

	declare person_id: ForeignKey<person["person_id"]>;

	declare getPerson: BelongsToGetAssociationMixin<person>;

	declare setPerson: BelongsToSetAssociationMixin<person, person["person_id"]>;

	declare createPerson: BelongsToCreateAssociationMixin<person>;

	declare person?: NonAttribute<person>;

	declare static associations: {
		person: Association<profiles, person>;
	};

	static initModel(sequelize: Sequelize): typeof profiles {
		profiles.init({
			profile_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			person_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "profiles",
			freezeTableName: true,
			timestamps: false,
			indexes: [
				{
					name: "sqlite_autoindex_profiles_2",
					unique: true,
					fields: [
						"person_id"
					]
				}
			]
		});
		return profiles;
	}

}