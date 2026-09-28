/**
 * Locate the end of a simple index source without splitting quoted identifiers
 * on pipes. Return undefined for source forms that cannot safely be rewritten.
 */
export function getPPLIndexSourceEnd(query: string): number | undefined {
  const source = /^\s*(?:search\s+)?(?:source|index)\s*=\s*/i.exec(query);
  if (!source) {
    return undefined;
  }

  const index = /^(?:`(?:\\.|``|[^`\\])+`|"(?:\\.|""|[^"\\])+"|'(?:\\.|''|[^'\\])+'|[\w.*?:/-]+)/;
  let position = source[0].length;
  while (position < query.length) {
    const name = index.exec(query.slice(position));
    if (!name) {
      return undefined;
    }
    position += name[0].length;
    const end = position;
    position += /^\s*/.exec(query.slice(position))![0].length;
    if (position === query.length || query[position] === '|') {
      return end;
    }
    if (query[position] !== ',') {
      return undefined;
    }
    position++;
    position += /^\s*/.exec(query.slice(position))![0].length;
  }
  return undefined;
}

/**
 * Move a dashboard predicate across a known pipeline suffix, not across commands
 * that may create or change its fields. Unknown source syntax is left unchanged.
 * This is deliberately not a general PPL parser or a predicate optimizer.
 */
export function getPPLFilterInsertionPoint(query: string, keys: string[]): number | undefined {
  const sourceEnd = getPPLIndexSourceEnd(query);
  if (sourceEnd === undefined) {
    return undefined;
  }
  const commands: Array<{ text: string; end: number }> = [];
  let start = 0;
  let quote = '';
  let depth = 0;
  const append = (end: number) => {
    const text = query.slice(start, end).trimEnd();
    commands.push({ text: text.trimStart(), end: start + text.length });
  };
  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        if (query[i + 1] === quote) {
          i++;
        } else {
          quote = '';
        }
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (
      char === '[' ||
      char === ']' ||
      char === '#' ||
      (char === '/' && i >= sourceEnd) ||
      ['/*', '--', '//'].includes(query.slice(i, i + 2))
    ) {
      // Subqueries, regex literals and comments need grammar-aware handling.
      return undefined;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      if (--depth < 0) {
        return undefined;
      }
    } else if (char === '|' && depth === 0) {
      append(i);
      start = i + 1;
    }
  }
  if (quote || depth !== 0) {
    return undefined;
  }
  append(query.length);
  for (let i = commands.length - 1; i > 0; i--) {
    const { text, end } = commands[i];
    const command = /^(\w+)\s+(.+)$/s.exec(text);
    if (!command) {
      return undefined;
    }
    const name = command[1].toLowerCase();
    if (['where', 'sort', 'head', 'fields'].includes(name)) {
      continue;
    }
    // The common pagination count is independent of the filtered field unless
    // the predicate itself uses its output. Other aggregations stay barriers.
    if (name === 'eventstats') {
      const count = /^count\(\s*\)\s+as\s+([a-zA-Z_][\w.]*)$/i.exec(command[2]);
      if (count && !keys.some((key) => key.toLowerCase() === count[1].toLowerCase())) {
        continue;
      }
    }
    // Includes eval, rename, stats, joins and commands unknown to this helper.
    return end;
  }
  return sourceEnd;
}
