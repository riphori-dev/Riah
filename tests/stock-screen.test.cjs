const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers.cjs');

test('Stock screen first/repeated focus preserves former-default-shaped user records without storage flags', async () => {
  const focus = [];
  const states = [];
  const react = {
    createElement: () => null,
    useState: (initial) => [initial, (value) => states.push(value)],
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: () => {},
  };
  const Value = function (value) {
    this.value = value;
  };
  const native = {
    Platform: { OS: 'web' },
    UIManager: {},
    StyleSheet: { create: (value) => value },
    Animated: { Value },
  };
  const h = harness({
    react,
    'react-native': native,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: { glyphMap: {} } },
    'react-native-gesture-handler': {},
    '@react-navigation/native': { useFocusEffect: (callback) => focus.push(callback) },
    'expo-haptics': {},
    '@/constants': {
      Colors: {},
      Spacing: {},
      useTheme: () => ({ colors: {} }),
      useThemedStyles: (factory) => factory({}),
    },
    '@/hooks/useAction': { useAction: () => ({ pending: false, error: null, run: (fn) => fn() }) },
    '@/components/ScreenFeedback': () => null,
  });
  try {
    const db = h.load('db/database.ts');
    await db.initDatabase();
    for (const row of [
      ['Newborn Diapers', 'Diapers', 2, 1, 'packs'],
      ['Wet Wipes', 'Wipes', 3, 1, 'packs'],
      ['Formula', 'Formula', 1, 1, 'cans'],
      ['Baby Tylenol', 'Medicine', 1, 1, 'bottles'],
      ['Real item', 'Other', 8, 2, 'pieces'],
    ])
      await db.stockItems.insert(...row);
    const before = await db.stockItems.getAll();
    h.load('app/(tabs)/stock.tsx').default();
    for (let i = 0; i < 3; i++) {
      focus[0]();
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.deepEqual(await db.stockItems.getAll(), before);
    assert.equal(h.storage.size, 0);
    h.failNext('SELECT * FROM stock_items');
    focus[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(states.includes('Injected write failure'));
    assert.deepEqual(await db.stockItems.getAll(), before);
  } finally {
    h.close();
  }
});
