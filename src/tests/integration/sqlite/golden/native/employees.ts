import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";

export class employees extends Model<InferAttributes<employees>, InferCreationAttributes<employees>> {

	declare employee_id: CreationOptional<number | null>;

	declare name: string;

	declare manager_id: ForeignKey<employees["employee_id"] | null>;

	declare getManager: BelongsToGetAssociationMixin<employees>;

	declare setManager: BelongsToSetAssociationMixin<employees, employees["employee_id"]>;

	declare createManager: BelongsToCreateAssociationMixin<employees>;

	declare getManagerEmployees: HasManyGetAssociationsMixin<employees>;

	declare setManagerEmployees: HasManySetAssociationsMixin<employees, employees["employee_id"]>;

	declare addManagerEmployee: HasManyAddAssociationMixin<employees, employees["employee_id"]>;

	declare addManagerEmployees: HasManyAddAssociationsMixin<employees, employees["employee_id"]>;

	declare removeManagerEmployee: HasManyRemoveAssociationMixin<employees, employees["employee_id"]>;

	declare removeManagerEmployees: HasManyRemoveAssociationsMixin<employees, employees["employee_id"]>;

	declare hasManagerEmployee: HasManyHasAssociationMixin<employees, employees["employee_id"]>;

	declare hasManagerEmployees: HasManyHasAssociationsMixin<employees, employees["employee_id"]>;

	declare countManagerEmployees: HasManyCountAssociationsMixin;

	declare createManagerEmployee: HasManyCreateAssociationMixin<employees, "manager_id">;

	declare manager?: NonAttribute<employees>;

	declare managerEmployees?: NonAttribute<employees[]>;

	declare static associations: {
		manager: Association<employees, employees>;
		managerEmployees: Association<employees, employees>;
	};

	static initModel(sequelize: Sequelize): typeof employees {
		employees.init({
			employee_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			manager_id: {
				type: DataTypes.INTEGER,
				allowNull: true
			}
		}, {
			sequelize,
			tableName: "employees",
			freezeTableName: true,
			timestamps: false
		});
		return employees;
	}

}