import '@testing-library/jest-dom';

import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
    subtle: crypto.webcrypto.subtle,
  },
});
