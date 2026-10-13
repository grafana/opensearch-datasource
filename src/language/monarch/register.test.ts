import { registerLanguage, __resetCompletionProviderRefsForTests, type LanguageDefinition } from './register';
import type { Completeable } from './types';

describe('registerLanguage completion provider refs', () => {
  const registeredProviders: Array<{ dispose: jest.Mock }> = [];

  const monaco = {
    languages: {
      getLanguages: jest.fn(() => [] as Array<{ id: string }>),
      register: jest.fn(),
      setMonarchTokensProvider: jest.fn(),
      setLanguageConfiguration: jest.fn(),
      registerCompletionItemProvider: jest.fn(() => {
        const disposable = { dispose: jest.fn() };
        registeredProviders.push(disposable);
        return disposable;
      }),
    },
  };

  const language: LanguageDefinition = {
    id: 'test-ppl',
    loader: async () =>
      ({
        language: {},
        conf: {},
      }) as any,
  };

  const completionItemProvider: Completeable = {
    getCompletionProvider: jest.fn(() => ({ provideCompletionItems: jest.fn() })),
  };

  beforeEach(() => {
    __resetCompletionProviderRefsForTests();
    registeredProviders.length = 0;
    jest.clearAllMocks();
    monaco.languages.getLanguages.mockReturnValue([]);
  });

  it('registers a single completion provider when two editors mount the same language', async () => {
    const first = await registerLanguage(monaco as any, language, completionItemProvider);
    monaco.languages.getLanguages.mockReturnValue([{ id: 'test-ppl' }]);
    const second = await registerLanguage(monaco as any, language, completionItemProvider);

    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(registeredProviders).toHaveLength(1);

    first?.dispose();
    expect(registeredProviders[0].dispose).not.toHaveBeenCalled();

    second?.dispose();
    expect(registeredProviders[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('re-attaches a provider after the last editor unmounts', async () => {
    const first = await registerLanguage(monaco as any, language, completionItemProvider);
    monaco.languages.getLanguages.mockReturnValue([{ id: 'test-ppl' }]);
    first?.dispose();

    expect(registeredProviders[0].dispose).toHaveBeenCalledTimes(1);

    await registerLanguage(monaco as any, language, completionItemProvider);
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(2);
  });
});
