import { caseTransformer } from '../../dialects/utils.js';
import { ITableMetadata } from '../../dialects/Dialect.js';
import { TransformMap } from '../../config/IConfig.js';

const buildTableMetadata = (): ITableMetadata => ({
    name: 'units',
    originName: 'units',
    schema: 'public',
    timestamps: true,
    paranoid: true,
    hasTrigger: true,
    deletedAt: 'deleted_at',
    foreignKeys: [
        {
            constraintName: 'units_race_id_fk',
            sourceTable: 'units',
            sourceColumns: ['race_id'],
            targetSchema: 'public',
            targetTable: 'races',
            targetColumns: ['race_id'],
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
            isSourceColumnUnique: false,
        },
    ],
    columns: {
        race_id: {
            name: 'race_id',
            originName: 'race_id',
            type: 'int4',
            typeExt: 'integer',
            primaryKey: false,
            allowNull: true,
            autoIncrement: false,
            foreignKey: {
                name: 'race_id',
                targetModel: 'races',
                targetKey: 'race_id',
                constraintName: 'units_race_id_fk',
                onDelete: 'CASCADE',
                onUpdate: 'RESTRICT',
                isUnique: false,
            },
        },
    },
});

describe('caseTransformer', () => {

    const transformMap: TransformMap = { model: 'PASCAL', column: 'CAMEL' };

    it('carries schema, paranoid, hasTrigger and foreign keys through unchanged', () => {
        const transformed = caseTransformer(buildTableMetadata(), transformMap);

        expect(transformed.schema).toBe('public');
        expect(transformed.paranoid).toBe(true);
        expect(transformed.hasTrigger).toBe(true);
        expect(transformed.foreignKeys).toEqual(buildTableMetadata().foreignKeys);
    });

    it('transforms deletedAt with the column case', () => {
        const transformed = caseTransformer(buildTableMetadata(), transformMap);

        expect(transformed.deletedAt).toBe('deletedAt');
    });

    it('transforms the column foreignKey preserving constraint metadata', () => {
        const transformed = caseTransformer(buildTableMetadata(), transformMap);

        expect(transformed.columns.race_id.foreignKey).toEqual({
            name: 'raceId',
            targetModel: 'Races',
            targetKey: 'raceId',
            constraintName: 'units_race_id_fk',
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
            isUnique: false,
        });
    });

});
