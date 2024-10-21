// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';
import * as crypto from 'crypto';

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    subtle: crypto.webcrypto.subtle,
  },
});

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

// Used by LinkButton -> Text component from grafana/ui
Object.defineProperty(global, 'ResizeObserver', {
  value: class ResizeObserver {
    //callback: ResizeObserverCallback;

    constructor(callback) {
      setTimeout(() => {
        callback(
          [
            {
              contentRect: {
                x: 1,
                y: 2,
                width: 500,
                height: 500,
                top: 100,
                bottom: 0,
                left: 100,
                right: 0,
              },
              target: {},
            },
          ],
          this
        );
      });
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  },
});
