import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';

import { Monaco } from '@grafana/ui';

import { Completeable } from './types';

export type LanguageDefinition = {
  id: string;
  extensions?: string[];
  aliases?: string[];
  mimetypes?: string[];
  loader: () => Promise<{
    language: monacoType.languages.IMonarchLanguage;
    conf: monacoType.languages.LanguageConfiguration;
  }>;
};

type ProviderRef = {
  disposable: monacoType.IDisposable;
  refs: number;
};

/** One shared completion provider per language id (Monaco providers are global). */
const completionProviderRefs = new Map<string, ProviderRef>();

/** @internal test-only */
export function __resetCompletionProviderRefsForTests() {
  completionProviderRefs.clear();
}

function retainCompletionProvider(
  monaco: Monaco,
  languageId: string,
  provider: monacoType.languages.CompletionItemProvider
): monacoType.IDisposable {
  const existing = completionProviderRefs.get(languageId);
  if (existing) {
    existing.refs += 1;
    return {
      dispose: () => releaseCompletionProvider(languageId),
    };
  }

  const disposable = monaco.languages.registerCompletionItemProvider(languageId, provider);
  completionProviderRefs.set(languageId, { disposable, refs: 1 });
  return {
    dispose: () => releaseCompletionProvider(languageId),
  };
}

function releaseCompletionProvider(languageId: string) {
  const entry = completionProviderRefs.get(languageId);
  if (!entry) {
    return;
  }
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.disposable.dispose();
    completionProviderRefs.delete(languageId);
  }
}

export const registerLanguage = async (
  monaco: Monaco,
  language: LanguageDefinition,
  completionItemProvider: Completeable
) => {
  const { id, loader } = language;
  const provider = completionItemProvider.getCompletionProvider(monaco, language);

  const languages = monaco.languages.getLanguages();
  if (languages.find((l) => l.id === id)) {
    // Language stays registered globally after unmount; retain/re-attach a single
    // shared completion provider so multiple editors do not duplicate suggestions.
    return retainCompletionProvider(monaco, id, provider);
  }

  monaco.languages.register({ id });
  return loader().then((monarch) => {
    monaco.languages.setMonarchTokensProvider(id, monarch.language);
    monaco.languages.setLanguageConfiguration(id, monarch.conf);
    return retainCompletionProvider(monaco, id, provider);
  });
};
