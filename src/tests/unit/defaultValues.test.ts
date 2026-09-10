import {
    parseDefaultValue,
    buildDefaultValueExpression,
    DefaultValueDescriptor,
} from '../../builders/defaultValues.js';
import { DATA_TYPE_NAMESPACES } from '../../dialects/dataTypes.js';
import { nodeToString } from '../../builders/utils.js';

describe('defaultValues', () => {

    describe('parseDefaultValue', () => {
        const cases: Array<{ name: string; raw: unknown; expected: DefaultValueDescriptor | undefined }> = [
            {
                name: 'a decorators-spelled DataType.NOW member',
                raw: 'DataType.NOW',
                expected: { kind: 'dataTypeMember', member: 'NOW' },
            },
            {
                name: 'a decorators-spelled DataType.UUIDV4 member',
                raw: 'DataType.UUIDV4',
                expected: { kind: 'dataTypeMember', member: 'UUIDV4' },
            },
            {
                name: 'a Sequelize.literal wrapper',
                raw: 'Sequelize.literal("nextval(\'seq\'::regclass)")',
                expected: { kind: 'sqlLiteral', sql: "nextval('seq'::regclass)" },
            },
            {
                name: 'a Sequelize.literal wrapper with escaped double quotes',
                raw: 'Sequelize.literal("nextval(\\"seq\\"::regclass)")',
                expected: { kind: 'sqlLiteral', sql: 'nextval("seq"::regclass)' },
            },
            {
                name: 'a numeric default',
                raw: 0,
                expected: { kind: 'number', value: 0 },
            },
            {
                name: 'a negative numeric default',
                raw: -1,
                expected: { kind: 'number', value: -1 },
            },
            {
                name: 'a boolean default',
                raw: true,
                expected: { kind: 'boolean', value: true },
            },
            {
                name: 'a plain string default',
                raw: 'active',
                expected: { kind: 'string', value: 'active' },
            },
            {
                name: 'an undefined default',
                raw: undefined,
                expected: undefined,
            },
            {
                name: 'a null default',
                raw: null,
                expected: undefined,
            },
        ];

        it.each(cases)('parses $name', ({ raw, expected }) => {
            expect(parseDefaultValue(raw)).toEqual(expected);
        });
    });

    describe('buildDefaultValueExpression', () => {
        it('renders a data type member under the native namespace', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'dataTypeMember', member: 'NOW' };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('DataTypes.NOW');
        });

        it('renders a data type member under the decorators namespace', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'dataTypeMember', member: 'UUIDV4' };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.decorators)))
                .toBe('DataType.UUIDV4');
        });

        it('renders a SQL literal through Sequelize.literal regardless of namespace', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'sqlLiteral', sql: "nextval('seq'::regclass)" };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('Sequelize.literal("nextval(\'seq\'::regclass)")');
        });

        it('renders a numeric default bare', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'number', value: 42 };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('42');
        });

        it('renders a negative numeric default', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'number', value: -1 };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('-1');
        });

        it('renders a boolean default', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'boolean', value: false };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('false');
        });

        it('renders a string default quoted', () => {
            const descriptor: DefaultValueDescriptor = { kind: 'string', value: 'active' };
            expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
                .toBe('"active"');
        });
    });

    it('round-trips a Sequelize.literal default from parse to expression', () => {
        const raw = 'Sequelize.literal("now()")';
        const descriptor = parseDefaultValue(raw);

        if (descriptor === undefined) {
            throw new Error('expected a descriptor');
        }

        expect(nodeToString(buildDefaultValueExpression(descriptor, DATA_TYPE_NAMESPACES.native)))
            .toBe('Sequelize.literal("now()")');
    });

});
