/**
 * h3-js v4 ships an emscripten build whose glue runs `new TextDecoder('utf-16le')`
 * at import time. React Native's built-in TextDecoder only knows utf-8 and throws
 * "Unknown encoding: utf-16le", which blows up the whole module on load.
 *
 * Swap in @zxing/text-encoding (pure JS, supports utf-16le) BEFORE any code that
 * imports h3-js. Import this file at the very top of the app entry (_layout.tsx).
 */
import { TextDecoder, TextEncoder } from '@zxing/text-encoding';

// Override unconditionally: RN's native TextDecoder exists but lacks utf-16le,
// so a `typeof` guard wouldn't be enough — we need the fuller implementation.
const g = globalThis as unknown as {
  TextDecoder: typeof TextDecoder;
  TextEncoder: typeof TextEncoder;
};
g.TextDecoder = TextDecoder;
g.TextEncoder = TextEncoder;
