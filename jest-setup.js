// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';
import Enzyme from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
import { TextEncoder } from 'util';

global.TextEncoder = TextEncoder;
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: crypto.webcrypto.subtle,
  },
});

Enzyme.configure({ adapter: new Adapter() });

Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
