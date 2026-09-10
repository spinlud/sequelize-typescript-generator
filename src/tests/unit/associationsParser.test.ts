import path from 'path';
import { fileURLToPath } from 'url';
import { AssociationsParser } from '../../dialects/AssociationsParser.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ASSOCIATIONS_PATH = path.join(currentDir, 'fixtures', 'associations.csv');
const ALT_ASSOCIATIONS_PATH = path.join(currentDir, 'fixtures', 'associationsAlt.csv');

describe('AssociationsParser', () => {

    describe('isJunctionForeignKey', () => {
        it('flags junction foreign keys of a many-to-many join table', () => {
            const parsed = AssociationsParser.parse(ASSOCIATIONS_PATH);

            expect(parsed.authors_books.foreignKeys).toEqual([
                { name: 'author_id', targetModel: 'authors', isJunctionForeignKey: true },
                { name: 'book_id', targetModel: 'books', isJunctionForeignKey: true },
            ]);
        });

        it('does not flag foreign keys of a one-to-many association', () => {
            const parsed = AssociationsParser.parse(ASSOCIATIONS_PATH);

            expect(parsed.units.foreignKeys).toEqual([
                { name: 'race_id', targetModel: 'races', isJunctionForeignKey: false },
            ]);
        });
    });

    describe('per-path cache', () => {
        it('keeps a separate result per path', () => {
            const parsed = AssociationsParser.parse(ASSOCIATIONS_PATH);
            const altParsed = AssociationsParser.parse(ALT_ASSOCIATIONS_PATH);

            expect(Object.keys(parsed).sort()).toEqual(['authors', 'authors_books', 'books', 'races', 'units']);
            expect(Object.keys(altParsed).sort()).toEqual(['passport', 'person']);
        });
    });

    describe('structural copies', () => {
        it('returns a fresh object on every call so callers cannot mutate the cache', () => {
            const first = AssociationsParser.parse(ASSOCIATIONS_PATH);
            const second = AssociationsParser.parse(ASSOCIATIONS_PATH);

            expect(second).toEqual(first);
            expect(second).not.toBe(first);
            expect(second.units).not.toBe(first.units);
            expect(second.units.foreignKeys).not.toBe(first.units.foreignKeys);
        });

        it('does not let a mutation of a returned result leak into later calls', () => {
            const mutated = AssociationsParser.parse(ASSOCIATIONS_PATH);
            mutated.units.foreignKeys.push({
                name: 'injected',
                targetModel: 'ghosts',
                isJunctionForeignKey: false,
            });

            const fresh = AssociationsParser.parse(ASSOCIATIONS_PATH);

            expect(fresh.units.foreignKeys).toEqual([
                { name: 'race_id', targetModel: 'races', isJunctionForeignKey: false },
            ]);
        });
    });

});
