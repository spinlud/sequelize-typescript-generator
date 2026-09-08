import { promises as fs } from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { Sequelize, Model, ModelStatic } from 'sequelize';
import { fixtureTables, INativeTableMetadata } from './fixture';
import * as factoryEmitter from './emitterFactory';
import * as templateEmitter from './emitterTemplate';

// One command that: (1) emits both outputs, (2) diffs them, (3) type-checks the generated
// files with tsc, and (4) proves the generated code runs against an in-memory SQLite database.

const FACTORY_DIR = path.join(__dirname, 'output', 'factory');
const TEMPLATE_DIR = path.join(__dirname, 'output', 'template');
const TSCONFIG = path.join(__dirname, 'tsconfig.prototype.json');
const TSC_BIN = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'tsc');

interface EmitterModule {
    emitModelFile(table: INativeTableMetadata): string;
    emitInitModelsFile(tables: INativeTableMetadata[]): string;
}

interface GeneratedFile {
    fileName: string;
    content: string;
}

/**
 * Produce the three generated files for one emitter.
 */
const generateFiles = (emitter: EmitterModule): GeneratedFile[] => {
    const tables = Object.values(fixtureTables);
    return [
        { fileName: 'Authors.ts', content: emitter.emitModelFile(fixtureTables.Authors) },
        { fileName: 'Books.ts', content: emitter.emitModelFile(fixtureTables.Books) },
        { fileName: 'initModels.ts', content: emitter.emitInitModelsFile(tables) },
    ];
};

/**
 * Write generated files to disk, recreating the target directory.
 */
const writeFiles = async (dir: string, files: GeneratedFile[]): Promise<void> => {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
        await fs.writeFile(path.join(dir, file.fileName), file.content);
    }
};

/**
 * Compare the two emitters' outputs file by file and print the result.
 */
const diffOutputs = (factoryFiles: GeneratedFile[], templateFiles: GeneratedFile[]): boolean => {
    let allIdentical = true;

    for (let i = 0; i < factoryFiles.length; i++) {
        const f = factoryFiles[i];
        const t = templateFiles[i];
        const identical = f.content === t.content;
        allIdentical = allIdentical && identical;
        console.log(`  ${f.fileName}: ${identical ? 'IDENTICAL' : 'DIFFERENT'}`);

        if (!identical) {
            const fl = f.content.split('\n');
            const tl = t.content.split('\n');
            for (let line = 0; line < Math.max(fl.length, tl.length); line++) {
                if (fl[line] !== tl[line]) {
                    console.log(`    line ${line + 1}:`);
                    console.log(`      factory : ${JSON.stringify(fl[line])}`);
                    console.log(`      template: ${JSON.stringify(tl[line])}`);
                }
            }
        }
    }

    return allIdentical;
};

/**
 * Type-check the generated factory output with the strict prototype tsconfig.
 */
const typeCheck = (): boolean => {
    try {
        execFileSync(TSC_BIN, ['-p', TSCONFIG], { stdio: 'pipe' });
        console.log('  tsc --noEmit (strict): PASS');
        return true;
    }
    catch (err) {
        console.log('  tsc --noEmit (strict): FAIL');
        if (err instanceof Error && 'stdout' in err) {
            const output = err.stdout;
            if (Buffer.isBuffer(output)) {
                console.log(output.toString());
            }
        }
        return false;
    }
};

/**
 * Type guard for the generated wiring module.
 */
const hasInitModels = (
    mod: unknown
): mod is { initModels: (sequelize: Sequelize) => Record<string, ModelStatic<Model>> } => {
    return (
        typeof mod === 'object' &&
        mod !== null &&
        'initModels' in mod &&
        typeof mod.initModels === 'function'
    );
};

/**
 * Prove the generated models sync, insert and query against in-memory SQLite.
 */
const proveRuntime = async (): Promise<void> => {
    const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

    // Load the generated wiring file produced by the factory emitter.
    const mod: unknown = require(path.join(FACTORY_DIR, 'initModels'));
    if (!hasInitModels(mod)) {
        throw new Error('Generated initModels module does not export initModels');
    }

    const models = mod.initModels(sequelize);
    await sequelize.sync({ force: true });

    const author = await models.Authors.create({ name: 'Ursula K. Le Guin' });
    const authorId = Number(author.getDataValue('id'));

    await models.Books.create({ title: 'A Wizard of Earthsea', subtitle: null, author_id: authorId });

    const book = await models.Books.findOne({
        where: { title: 'A Wizard of Earthsea' },
        include: [{ model: models.Authors, as: 'author' }],
    });

    console.log('  query result: ' + JSON.stringify(book?.toJSON()));

    await sequelize.close();
};

const main = async (): Promise<void> => {
    const factoryFiles = generateFiles(factoryEmitter);
    const templateFiles = generateFiles(templateEmitter);

    await writeFiles(FACTORY_DIR, factoryFiles);
    await writeFiles(TEMPLATE_DIR, templateFiles);
    console.log(`Wrote ${factoryFiles.length} files to output/factory and output/template`);

    console.log('\n[1] Diff factory vs template output:');
    const identical = diffOutputs(factoryFiles, templateFiles);
    console.log(`  => ${identical ? 'ALL IDENTICAL' : 'MISMATCH'}`);

    console.log('\n[2] Type-check generated files:');
    typeCheck();

    console.log('\n[3] Runtime proof (in-memory SQLite):');
    await proveRuntime();

    console.log('\nDone.');
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
