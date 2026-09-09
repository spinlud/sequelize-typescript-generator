#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.resolve(__dirname, '..', 'build');

const FORBIDDEN_PATTERNS = [
    'require("sequelize-typescript")',
    "require('sequelize-typescript')",
    'from "sequelize-typescript"',
    "from 'sequelize-typescript'",
];

/**
 * Recursively collect every .js file under a directory.
 * @param {string} directory
 * @returns {string[]}
 */
function collectJsFiles(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...collectJsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

function main() {
    if (!fs.existsSync(BUILD_DIR)) {
        console.error(`check-deps: build directory not found at ${BUILD_DIR}. Run the build first.`);
        process.exit(1);
    }

    const offendingFiles = [];

    for (const file of collectJsFiles(BUILD_DIR)) {
        const content = fs.readFileSync(file, 'utf8');

        if (FORBIDDEN_PATTERNS.some((pattern) => content.includes(pattern))) {
            offendingFiles.push(file);
        }
    }

    if (offendingFiles.length > 0) {
        console.error('check-deps: found runtime references to sequelize-typescript in the build output:');
        for (const file of offendingFiles) {
            console.error(`  - ${path.relative(process.cwd(), file)}`);
        }
        console.error('sequelize-typescript must remain an optional peer dependency and must not be required at runtime.');
        process.exit(1);
    }

    console.log('check-deps: no runtime references to sequelize-typescript found in build output.');
    process.exit(0);
}

main();
