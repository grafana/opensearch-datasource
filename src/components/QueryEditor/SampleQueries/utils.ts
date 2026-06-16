import { Token } from '@grafana/ui';
import Prism, { Grammar } from 'prismjs';
import * as ppl from '../../../language/ppl/language';

function flattenToken(token: string | Prism.Token | Array<string | Prism.Token>): Token[] {
  if (typeof token === 'string') {
    return [
      {
        content: token,
        types: [],
        aliases: [],
      },
    ];
  } else if (Array.isArray(token)) {
    return token.flatMap((t) => flattenToken(t));
  } else if (token instanceof Prism.Token) {
    return flattenToken(token.content).flatMap((t) => {
      let aliases: string[] = [];
      if (typeof token.alias === 'string') {
        aliases = [token.alias];
      } else {
        aliases = token.alias ?? [];
      }

      return {
        content: t.content,
        types: [token.type, ...t.types],
        aliases: [...aliases, ...t.aliases],
      };
    });
  }

  return [];
}

export function flattenTokens(token: string | Prism.Token | Array<string | Prism.Token>) {
  const tokens = flattenToken(token);

  if (!tokens.length) {
    return [];
  }

  const firstToken = tokens[0];
  firstToken.prev = null;
  firstToken.next = tokens.length >= 2 ? tokens[1] : null;
  firstToken.offsets = {
    start: 0,
    end: firstToken.content.length,
  };

  for (let i = 1; i < tokens.length - 1; i++) {
    tokens[i].prev = tokens[i - 1];
    tokens[i].next = tokens[i + 1];

    tokens[i].offsets = {
      start: tokens[i - 1].offsets!.end,
      end: tokens[i - 1].offsets!.end + tokens[i].content.length,
    };
  }

  const lastToken = tokens[tokens.length - 1];
  lastToken.prev = tokens.length >= 2 ? tokens[tokens.length - 2] : null;
  lastToken.next = null;
  lastToken.offsets = {
    start: tokens.length >= 2 ? tokens[tokens.length - 2].offsets!.end : 0,
    end:
      tokens.length >= 2 ? tokens[tokens.length - 2].offsets!.end + lastToken.content.length : lastToken.content.length,
  };

  return tokens;
}

export const baseTokenizer = (languageSpecificFeatures: Grammar): Grammar => ({
  comment: {
    pattern: /^#.*/,
    greedy: true,
  },
  backticks: {
    pattern: /`.*?`/,
    alias: 'string',
    greedy: true,
  },
  quote: {
    pattern: /[\"'].*?[\"']/,
    alias: 'string',
    greedy: true,
  },
  regex: {
    pattern: /\/.*?\/(?=\||\s*$|,)/,
    greedy: true,
  },
  ...languageSpecificFeatures,

  'field-name': {
    pattern: /(@?[_a-zA-Z]+[_.0-9a-zA-Z]*)|(`((\\`)|([^`]))*?`)/,
    greedy: true,
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  'command-separator': {
    pattern: /\|/,
    alias: 'punctuation',
  },
  'comparison-operator': {
    pattern: /([<>]=?)|(!?=)/,
  },
  punctuation: /[{}()`,.]/,
  whitespace: /\s+/,
});

export const pplTokenizer: Grammar = {
  ...baseTokenizer({
    'query-command': {
      pattern: new RegExp(`\\b(?:${ppl.PPL_COMMANDS.join('|')})\\b`, 'i'),
      alias: 'function',
    },
    function: {
      pattern: new RegExp(`\\b(?:${ppl.ALL_FUNCTIONS.join('|')})\\b`, 'i'),
    },
    keyword: {
      pattern: new RegExp(`(\\s+)(${ppl.ALL_KEYWORDS.join('|')})(?=\\s+)`, 'i'),
      lookbehind: true,
    },
    operator: {
      pattern: new RegExp(`\\b(?:${ppl.PPL_OPERATORS.map((operator) => `\\${operator}`).join('|')})\\b`, 'i'),
    },
  }),
};
