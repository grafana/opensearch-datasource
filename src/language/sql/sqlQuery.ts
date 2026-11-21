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

/**
 * Finds the table a SQL query reads from, which is the index the index picker
 * shows. An empty string means the query names no table, either because it has
 * no FROM clause or because its table is a subquery.
 */
export const getSQLIndex = (query: string): string => {
  const range = findFromClauseTable(query);
  return range ? unquote(range.table) : '';
};

/**
 * Points a SQL query at another index and keeps the rest of it.
 *
 * The index picker sets `query.index` as well, but a SQL query names its table
 * itself, so leaving the text alone would have the picker show one index while
 * the query reads another.
 */
export const replaceOrSetSQLIndex = (query: string, newIndex: string): string => {
  const trimmed = query.trim();

  if (trimmed === '') {
    return `SELECT * FROM ${newIndex} LIMIT 10`;
  }

  const range = findFromClauseTable(trimmed);
  if (range) {
    return `${trimmed.slice(0, range.start)}${newIndex}${trimmed.slice(range.end)}`;
  }

  if (range === null) {
    // The table is a subquery, which has a FROM clause of its own. Rewriting it
    // would change what the query reads, so it is left alone.
    return trimmed;
  }

  // A query without a FROM clause still has to read something: the clause goes
  // after the SELECT list, which precedes any WHERE, GROUP BY or LIMIT.
  const insertAt = firstTopLevelKeyword(trimmed, ['WHERE', 'GROUP', 'ORDER', 'LIMIT', 'HAVING']);
  if (insertAt === -1) {
    return `${trimmed} FROM ${newIndex}`;
  }

  return `${trimmed.slice(0, insertAt)}FROM ${newIndex} ${trimmed.slice(insertAt)}`;
};

interface TableRange {
  /** Start and end of the table reference in the query, excluding the FROM keyword. */
  start: number;
  end: number;
  table: string;
}

/**
 * Finds the table named by the first top-level FROM clause.
 *
 * Returns undefined when there is no FROM clause, and null when the FROM reads
 * from a subquery rather than a table.
 */
const findFromClauseTable = (query: string, searchFrom = 0): TableRange | null | undefined => {
  let fromIdx = findTopLevelKeyword(query.slice(searchFrom), 'FROM');
  fromIdx = fromIdx === -1 ? -1 : fromIdx + searchFrom;
  while (fromIdx !== -1) {
    let i = fromIdx + 'FROM'.length;
    while (i < query.length && /\s/.test(query[i])) {
      i++;
    }

    const start = i;
    if (query[i] === '(') {
      return null;
    }

    if (query[i] === '`' || query[i] === '"') {
      const quote = query[i];
      i++;
      while (i < query.length && query[i] !== quote) {
        i++;
      }
      i++;
    } else {
      // An unquoted table name runs to the next whitespace, comma or parenthesis,
      // and may contain the wildcard of a multi-index query.
      while (i < query.length && !/[\s,()]/.test(query[i])) {
        i++;
      }
    }

    if (i > start) {
      return { start, end: i, table: query.slice(start, i) };
    }

    // A FROM keyword with no table after it, such as the one inside
    // EXTRACT(YEAR FROM ts), is not a table reference.
    return findFromClauseTable(query, fromIdx + 'FROM'.length);
  }

  return undefined;
};

const unquote = (table: string): string =>
  table.length > 1 && (table[0] === '`' || table[0] === '"') && table[table.length - 1] === table[0]
    ? table.slice(1, -1)
    : table;

/** Finds the first of several top-level keywords, which precedes a clause. */
const firstTopLevelKeyword = (query: string, keywords: string[]): number => {
  const positions = keywords.map((keyword) => findTopLevelKeyword(query, keyword)).filter((position) => position !== -1);
  return positions.length === 0 ? -1 : Math.min(...positions);
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
