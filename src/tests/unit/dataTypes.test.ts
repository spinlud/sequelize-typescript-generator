import { DataTypes } from 'sequelize';
import {
    isSequelizeDataTypeKey,
    resolveSequelizeDataTypeKey,
    buildSequelizeDataType,
    renderDataTypeExpression,
    parseEnumValues,
    DATA_TYPE_NAMESPACES,
    ISequelizeDataType,
} from '../../dialects/dataTypes.js';

describe('data types mapper', () => {

    describe('isSequelizeDataTypeKey', () => {
        it('recognizes members of DataTypes only', () => {
            expect(isSequelizeDataTypeKey('DECIMAL')).toBe(true);
            expect(isSequelizeDataTypeKey('DOUBLE')).toBe(true);
            expect(isSequelizeDataTypeKey('NOT_A_TYPE')).toBe(false);
        });
    });

    describe('resolveSequelizeDataTypeKey', () => {
        it('collapses DOUBLE PRECISION to DOUBLE', () => {
            expect(resolveSequelizeDataTypeKey(DataTypes.DOUBLE)).toBe('DOUBLE');
        });

        it('keeps a single-token key', () => {
            expect(resolveSequelizeDataTypeKey(DataTypes.DECIMAL)).toBe('DECIMAL');
            expect(resolveSequelizeDataTypeKey(DataTypes.ENUM)).toBe('ENUM');
        });
    });

    describe('buildSequelizeDataType', () => {
        it('drops null and undefined arguments', () => {
            expect(buildSequelizeDataType(DataTypes.DECIMAL, [7, null, undefined, 3])).toEqual({
                key: 'DECIMAL',
                args: [7, 3],
            });
        });

        it('drops falsy numeric arguments like a zero scale', () => {
            expect(buildSequelizeDataType(DataTypes.DECIMAL, [7, 0])).toEqual({
                key: 'DECIMAL',
                args: [7],
            });
        });
    });

    describe('renderDataTypeExpression', () => {
        it('renders with no arguments', () => {
            const dataType: ISequelizeDataType = { key: 'INTEGER', args: [] };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.decorators)).toBe('DataType.INTEGER');
        });

        it('renders numeric arguments without spaces', () => {
            const dataType: ISequelizeDataType = { key: 'DECIMAL', args: [7, 3] };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.decorators)).toBe('DataType.DECIMAL(7,3)');
        });

        it('renders ENUM values single-quoted in the native namespace', () => {
            const dataType: ISequelizeDataType = { key: 'ENUM', args: ['AA', 'BB'] };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native)).toBe("DataTypes.ENUM('AA','BB')");
        });

        it('renders mixed string and numeric arguments', () => {
            const dataType: ISequelizeDataType = { key: 'STRING', args: [255] };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.decorators)).toBe('DataType.STRING(255)');
        });

        it('renders a nested data type argument in the native namespace', () => {
            const dataType: ISequelizeDataType = {
                key: 'ARRAY',
                args: [{ key: 'INTEGER', args: [] }],
            };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native))
                .toBe('DataTypes.ARRAY(DataTypes.INTEGER)');
        });

        it('renders a nested data type argument in the decorators namespace', () => {
            const dataType: ISequelizeDataType = {
                key: 'ARRAY',
                args: [{ key: 'TEXT', args: [] }],
            };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.decorators))
                .toBe('DataType.ARRAY(DataType.TEXT)');
        });

        it('renders arguments of a nested data type argument', () => {
            const dataType: ISequelizeDataType = {
                key: 'ARRAY',
                args: [{ key: 'DECIMAL', args: [7, 3] }],
            };
            expect(renderDataTypeExpression(dataType, DATA_TYPE_NAMESPACES.native))
                .toBe('DataTypes.ARRAY(DataTypes.DECIMAL(7,3))');
        });
    });

    describe('parseEnumValues', () => {
        it('extracts values from an enum column type', () => {
            expect(parseEnumValues("enum('AA','BB','CC')")).toEqual(['AA', 'BB', 'CC']);
        });

        it('unescapes doubled single quotes', () => {
            expect(parseEnumValues("enum('a''b','c')")).toEqual(["a'b", 'c']);
        });

        it('returns an empty array for non-enum types', () => {
            expect(parseEnumValues('varchar(255)')).toEqual([]);
            expect(parseEnumValues('int')).toEqual([]);
            expect(parseEnumValues('text')).toEqual([]);
        });
    });

});
