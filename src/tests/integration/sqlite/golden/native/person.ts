import {
	Association, CreationOptional, DataTypes, HasOneCreateAssociationMixin, HasOneGetAssociationMixin, HasOneSetAssociationMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { passport } from "./passport";
import type { profiles } from "./profiles";

export class person extends Model<InferAttributes<person>, InferCreationAttributes<person>> {

	declare person_id: CreationOptional<number | null>;

	declare name: string;

	declare passport_id: number;

	declare getProfile: HasOneGetAssociationMixin<profiles>;

	declare setProfile: HasOneSetAssociationMixin<profiles, profiles["profile_id"]>;

	declare createProfile: HasOneCreateAssociationMixin<profiles>;

	declare getPassport: HasOneGetAssociationMixin<passport>;

	declare setPassport: HasOneSetAssociationMixin<passport, passport["passport_id"]>;

	declare createPassport: HasOneCreateAssociationMixin<passport>;

	declare profile?: NonAttribute<profiles>;

	declare passport?: NonAttribute<passport>;

	declare static associations: {
		profile: Association<person, profiles>;
		passport: Association<person, passport>;
	};

	static initModel(sequelize: Sequelize): typeof person {
		person.init({
			person_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			passport_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "person",
			freezeTableName: true,
			timestamps: false
		});
		return person;
	}

}