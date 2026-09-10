import { Sequelize } from "sequelize";
import { data_types } from "./data_types";
import { indices } from "./indices";
import { authors } from "./authors";
import { books } from "./books";
import { authors_books } from "./authors_books";
import { races } from "./races";
import { units } from "./units";
import { person } from "./person";
import { passport } from "./passport";
import { employees } from "./employees";
import { profiles } from "./profiles";
import { order_lines } from "./order_lines";
import { shipments } from "./shipments";
import { soft_deletes } from "./soft_deletes";

export function initModels(sequelize: Sequelize) {
	data_types.initModel(sequelize);
	indices.initModel(sequelize);
	authors.initModel(sequelize);
	books.initModel(sequelize);
	authors_books.initModel(sequelize);
	races.initModel(sequelize);
	units.initModel(sequelize);
	person.initModel(sequelize);
	passport.initModel(sequelize);
	employees.initModel(sequelize);
	profiles.initModel(sequelize);
	order_lines.initModel(sequelize);
	shipments.initModel(sequelize);
	soft_deletes.initModel(sequelize);
	authors.belongsToMany(books, {
		as: "books",
		through: authors_books,
		foreignKey: "author_id",
		otherKey: "book_id"
	});
	books.belongsToMany(authors, {
		as: "authors",
		through: authors_books,
		foreignKey: "book_id",
		otherKey: "author_id"
	});
	races.hasMany(units, {
		as: "units",
		foreignKey: "race_id",
		sourceKey: "race_id"
	});
	units.belongsTo(races, {
		as: "race",
		foreignKey: "race_id",
		targetKey: "race_id"
	});
	person.hasOne(profiles, {
		as: "profile",
		foreignKey: "person_id",
		sourceKey: "person_id",
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});
	person.hasOne(passport, {
		as: "passport",
		foreignKey: "passport_id",
		sourceKey: "passport_id"
	});
	passport.belongsTo(person, {
		as: "person",
		foreignKey: "passport_id"
	});
	employees.belongsTo(employees, {
		as: "manager",
		foreignKey: "manager_id",
		targetKey: "employee_id",
		onDelete: "SET NULL"
	});
	employees.hasMany(employees, {
		as: "managerEmployees",
		foreignKey: "manager_id",
		sourceKey: "employee_id",
		onDelete: "SET NULL"
	});
	profiles.belongsTo(person, {
		as: "person",
		foreignKey: "person_id",
		targetKey: "person_id",
		onDelete: "CASCADE",
		onUpdate: "CASCADE"
	});
	return {
		data_types,
		indices,
		authors,
		books,
		authors_books,
		races,
		units,
		person,
		passport,
		employees,
		profiles,
		order_lines,
		shipments,
		soft_deletes
	};
}

export type Models = ReturnType<typeof initModels>;