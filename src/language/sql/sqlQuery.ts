/**
 * Builds the SQL that a query is sent as.
 *
 * The Go backend does the same for a panel query, but a query variable is sent
 * through the resource route, so the time range has to be applied here.
 */
export const applyTimeRangeToSQLQuery = (query: string, timeField: string, from: string, to: string): string => {
  const trimmed = query.trim().replace(/;\s*$/, '');
  const field = (timeField ?? '').trim();
  if (!field) {
    return trimmed;
  }

  const timeFilter = `\`${field}\` >= '${from}' AND \`${field}\` <= '${to}'`;
  const whereIdx = findTopLevelKeyword(trimmed, 'WHERE');
  if (whereIdx === -1) {
    return `${trimmed} WHERE ${timeFilter}`;
  }

  return `${trimmed} AND ${timeFilter}`;
};

const findTopLevelKeyword = (query: string, keyword: string): number => {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];

    if (quote) {
      if (char === quote) {
        if (query[i + 1] === quote) {
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth++;
      continue;
    }
    if (char === ')') {
      depth--;
      continue;
    }
    if (depth !== 0) {
      continue;
    }

    const rest = query.slice(i).toUpperCase();
    if (!rest.startsWith(keyword)) {
      continue;
    }
    const before = i === 0 ? ' ' : query[i - 1];
    const after = query[i + keyword.length] ?? ' ';
    if (/\s/.test(before) && /\s/.test(after)) {
      return i;
    }
  }

  return -1;
};
