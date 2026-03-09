// Loads GAS source files into a shared global context with mocked GAS APIs.
// This lets us test pure logic without running in the Apps Script environment.

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createGasContext(overrides = {}) {
  return {
    Logger: { log: () => {} },
    GmailApp: {
      search: () => [],
      getMessagesForThreads: () => [],
      getUserLabelByName: () => null,
      createLabel: (name) => ({ name, addToThreads: () => {} }),
      getUserLabels: () => [],
      moveThreadsToArchive: () => {},
    },
    PropertiesService: {
      getUserProperties: () => ({
        getProperty: () => null,
        setProperty: () => {},
        deleteProperty: () => {},
      }),
    },
    ScriptApp: {
      newTrigger: () => ({
        timeBased: () => ({
          everyMinutes: () => ({
            create: () => {},
          }),
        }),
      }),
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
    },
    Session: {
      getScriptTimeZone: () => 'America/New_York',
    },
    Utilities: {
      formatDate: (date, _tz, _fmt) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
      },
    },
    UrlFetchApp: {
      fetch: () => ({ getResponseCode: () => 200 }),
    },
    ...overrides,
  };
}

export function loadGasEnvironment(overrides = {}) {
  const context = createGasContext(overrides);
  const sandbox = vm.createContext(context);

  const srcDir = path.join(__dirname, '..', 'src');
  const files = ['config.js', 'headers.js', 'labeler.js', 'muter.js', 'main.js'];

  for (const file of files) {
    const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
    vm.runInContext(code, sandbox, { filename: file });
  }

  return sandbox;
}
