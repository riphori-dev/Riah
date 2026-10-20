const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');

function harness(overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const storage = new Map();
  let fail = null;
  const check = (sql) => {
    if (fail && sql.includes(fail)) {
      fail = null;
      throw new Error('Injected write failure');
    }
  };
  const database = {
    execAsync: async (sql) => {
      check(sql);
      sqlite.exec(sql);
    },
    runAsync: async (sql, args = []) => {
      check(sql);
      const result = sqlite.prepare(sql).run(...args);
      return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getAllAsync: async (sql, args = []) => {
      check(sql);
      return sqlite
        .prepare(sql)
        .all(...args)
        .map((row) => ({ ...row }));
    },
    getFirstAsync: async (sql, args = []) => {
      check(sql);
      const row = sqlite.prepare(sql).get(...args);
      return row ? { ...row } : null;
    },
    withTransactionAsync: async (action) => {
      sqlite.exec('BEGIN');
      try {
        await action();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const mocks = {
    'expo-sqlite': { openDatabaseAsync: async () => database },
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => {
        storage.set(key, value);
      },
    },
    ...overrides,
  };
  const cache = new Map();
  function load(name) {
    const filename = path.resolve(root, name);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    function localRequire(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        let target = specifier.startsWith('@/')
          ? path.join(root, specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        if (!path.extname(target))
          target = ['.ts', '.tsx', '/index.ts']
            .map((suffix) => target + suffix)
            .find(fs.existsSync);
        return load(target);
      }
      return require(specifier);
    }
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
      localRequire,
      module,
      module.exports,
    );
    return module.exports;
  }
  return {
    load,
    database,
    sqlite,
    storage,
    failNext: (sql) => {
      fail = sql;
    },
    close: () => sqlite.close(),
  };
}
module.exports = { harness };
