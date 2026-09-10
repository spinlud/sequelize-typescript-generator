import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { person } from "./person";

export class passport extends Model<InferAttributes<passport>, InferCreationAttributes<passport>> {

	declare passport_id: ForeignKey<person["person_id"] | null>;

	declare code: string;

	declare getPerson: BelongsToGetAssociationMixin<person>;

	declare setPerson: BelongsToSetAssociationMixin<person, person["person_id"]>;

	declare createPerson: BelongsToCreateAssociationMixin<person>;

	declare person?: NonAttribute<person>;

	declare static associations: {
		person: Association<passport, person>;
	};

	static initModel(sequelize: Sequelize): typeof passport {
		passport.init({
			passport_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			code: {
				type: DataTypes.STRING,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "passport",
			freezeTableName: true,
			timestamps: false
		});
		return passport;
	}

}