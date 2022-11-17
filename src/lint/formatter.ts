import fs from 'fs';
import path from 'path';
import glob from 'glob';
import prettier from 'prettier';

const readFile = (filePath: string) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, fileContent) => {
      if (error != null) {
        reject(error);
        return;
      }

      resolve(fileContent);
    });
  });
};

const writeFile = (filePath: string, fileContent: string) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, fileContent, writeFileError => {
      if (writeFileError) {
        reject(writeFileError);
        return;
      }

      resolve(filePath);
    });
  });
};

const formatFile = async (ioFilePath: string, configDictionary: {[key: string]: prettier.Options}) => {
  const fileDir = path.dirname(ioFilePath);
  const prettierConfig = configDictionary[fileDir];
  
  const fileContent = await readFile(ioFilePath) as string;
  const writtenFilePath = await writeFile(
    ioFilePath,
    prettier.format(fileContent, {
      ...prettierConfig, 
      filepath: ioFilePath,
      parser: 'typescript'
    }),
  );

  return writtenFilePath;
};

const getSourceFilePaths = async (filePattern: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    glob(filePattern, (error, files) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(files);
    });
  });
};

const getGlobPath = (filePattern: string): string => {
  return filePattern.replace(/\\/g, '/').replace(/^[a-zA-Z]\:/, '');
};

const getConfigDictionary = async (filePaths: string[]): Promise<{[key: string]: prettier.Options}> => {
  const configDictionary: {[key: string]: prettier.Options} = {};

  for (const f of filePaths) {
    const fileDir = path.dirname(f);
    if (!configDictionary[fileDir]) {
      const cfg = await prettier.resolveConfig(f);
      configDictionary[fileDir] = cfg || { singleQuote: true };
    }
  }
  return configDictionary;
};

export const formatSource = async (filePattern: string) => {
  console.log('Formatting source files...');

  try {
    const globPattern = getGlobPath(filePattern);
    const sourceFilePaths = await getSourceFilePaths(globPattern);
    const prettierConfigDictionary = await getConfigDictionary(sourceFilePaths);
    const formattedPaths = await Promise.all(sourceFilePaths.map(filePath => formatFile(filePath, prettierConfigDictionary)));

    console.log(`    ... done formatting ${formattedPaths.length} files.`);
  } catch (error) {
    console.log('Problem formatting file:\n', error);
    process.exit(1);
  }
};