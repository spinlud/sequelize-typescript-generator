import { Sequelize } from "sequelize";
import { Authors } from "./Authors";
import { Books } from "./Books";

export function initModels(sequelize: Sequelize) {
    Authors.initModel(sequelize);
    Books.initModel(sequelize);
    Authors.hasMany(Books, {
        sourceKey: "id",
        foreignKey: "author_id",
        as: "books"
    });
    Books.belongsTo(Authors, {
        targetKey: "id",
        foreignKey: "author_id",
        as: "author"
    });
    return {
        Authors,
        Books
    };
}
