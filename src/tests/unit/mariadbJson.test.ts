import {
    extractJsonColumnsFromCheckConstraints,
    extractJsonColumnsFromCreateTable,
    getCreateTableStatement,
} from '../../dialects/mariadbJson.js';

describe('extractJsonColumnsFromCheckConstraints', () => {
    it('extracts the column of a json_valid check clause', () => {
        const columns = extractJsonColumnsFromCheckConstraints([
            { CHECK_CLAUSE: 'json_valid(`f_json`)' },
            { CHECK_CLAUSE: 'json_valid(`payload`)' },
        ]);

        expect([...columns].sort()).toEqual(['f_json', 'payload']);
    });

    it('tolerates missing backticks and surrounding whitespace', () => {
        const columns = extractJsonColumnsFromCheckConstraints([
            { CHECK_CLAUSE: 'json_valid( f_json )' },
        ]);

        expect([...columns]).toEqual(['f_json']);
    });

    it('ignores check clauses that are not json_valid', () => {
        const columns = extractJsonColumnsFromCheckConstraints([
            { CHECK_CLAUSE: '`age` > 0' },
        ]);

        expect(columns.size).toBe(0);
    });
});

describe('extractJsonColumnsFromCreateTable', () => {
    it('extracts json columns from a SHOW CREATE TABLE statement', () => {
        const createStatement = [
            'CREATE TABLE `data_types` (',
            '  `id` int(11) NOT NULL AUTO_INCREMENT,',
            '  `f_longtext` longtext DEFAULT NULL,',
            '  `f_json` longtext CHARACTER SET utf8mb4 DEFAULT NULL CHECK (json_valid(`f_json`)),',
            '  PRIMARY KEY (`id`)',
            ')',
        ].join('\n');

        const columns = extractJsonColumnsFromCreateTable(createStatement);

        expect([...columns]).toEqual(['f_json']);
    });
});

describe('getCreateTableStatement', () => {
    it('reads the create statement regardless of column-name case', () => {
        expect(getCreateTableStatement({ 'Create Table': 'CREATE TABLE a' })).toBe('CREATE TABLE a');
        expect(getCreateTableStatement({ 'CREATE TABLE': 'CREATE TABLE b' })).toBe('CREATE TABLE b');
        expect(getCreateTableStatement(undefined)).toBe('');
    });
});
