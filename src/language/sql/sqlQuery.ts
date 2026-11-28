/**
 * Builds the SQL that a query is sent as.
 *
 * The Go backend does the same for a panel query, but a query variable is sent
 * through the resource route, so the time range has to be applied here.
 */
export const applyTimeRangeToSQLQuery = (query: string, timeField: string, from: string, to: string): string => {
  const trimmed = normalizeSQLQuery(query);
  const field = (timeField ?? '').trim();
  if (!field) {
    return trimmed;
  }

  const timeFilter = `\`${field}\` >= '${from}' AND \`${field}\` <= '${to}'`;
  const whereIdx = findTopLevelKeyword(trimmed, 'WHERE');

  // A clause that has to follow the WHERE clause ends it, so the filter goes in
  // front of the first of them rather than at the end of the query. Adding it at
  // the end would put it after a GROUP BY, an ORDER BY or a LIMIT, which the
  // engine rejects with `Invalid SQL query`.
  const clauseIdx = firstTopLevelKeyword(trimmed, ['GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET']);

  if (whereIdx === -1) {
    const insertAt = clauseIdx === -1 ? beforeTrailingComment(trimmed) : clauseIdx;
    return splice(trimmed, insertAt, `WHERE ${timeFilter}`);
  }

  const endIdx = clauseIdx !== -1 && clauseIdx > whereIdx ? clauseIdx : beforeTrailingComment(trimmed);
  const condition = trimmed.slice(whereIdx + 'WHERE'.length, endIdx);

  // `AND` binds tighter than `OR`, so the existing condition has to be grouped
  // before the filter is added, or the filter would only apply to the last
  // branch of the OR. The parentheses close before a comment that ends the
  // condition: a line comment runs to the end of its line, so it would take the
  // closing parenthesis with it.
  if (hasTopLevelOr(condition)) {
    const closingIdx = beforeComment(condition);
    const grouped = condition.slice(0, closingIdx).trim();
    const comment = condition.slice(closingIdx).trim();
    const groupedWithFilter = `(${grouped}) AND ${timeFilter}${comment === '' ? '' : ` ${comment}`}`;
    return splice(trimmed, whereIdx, `WHERE ${groupedWithFilter}`, endIdx);
  }

  return splice(trimmed, endIdx, `AND ${timeFilter}`);
};

/**
 * Trims a query and removes the semicolons that terminate it, which the engine
 * does not need. They are removed from the end of the query and from in front of
 * a comment that ends it, because a query with a statement terminator in the
 * middle is rejected.
 *
 * A query with an unterminated comment or literal is refused: the filter cannot
 * be placed in a query that cannot be read to the end, and sending it unfiltered
 * returns every document instead of the selected time range.
 */
export const normalizeSQLQuery = (query: string): string => {
  let result = query.trim();

  for (;;) {
    const commentAt = trailingCommentStart(result);
    const body = commentAt === -1 ? result : result.slice(0, commentAt);
    const comment = commentAt === -1 ? '' : result.slice(commentAt);
    const stripped = body.replace(/[ \t\r\n;]+$/, '');
    const next = [stripped, comment].filter((part) => part !== '').join(' ');
    if (next === result) {
      break;
    }
    result = next;
  }

  assertTerminated(result);
  return result;
};

/**
 * The offset of a comment that runs to the end of the query, or -1.
 *
 * A comment marker inside a literal is not a comment, so the literal is skipped
 * the way the tokenizer skips it.
 */
const trailingCommentStart = (query: string): number => {
  for (let i = 0; i < query.length; i++) {
    const literalEnd = skipLiteral(query, i);
    if (literalEnd !== i) {
      i = literalEnd - 1;
      continue;
    }
    const end = skipComment(query, i);
    if (end !== i) {
      if (end >= query.length) {
        return i;
      }
      i = end - 1;
    }
  }
  return -1;
};

/** Returns the offset just past a quoted literal that starts at the given offset. */
const skipLiteral = (query: string, at: number): number => {
  const quote = query[at];
  if (quote !== "'" && quote !== '"' && quote !== '`') {
    return at;
  }
  let i = at + 1;
  while (i < query.length) {
    if (query[i] === '\\') {
      i += 2;
      continue;
    }
    if (query[i] === quote) {
      if (query[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return query.length;
};

/** Throws when the query ends inside a comment or a literal. */
const assertTerminated = (query: string): void => {
  for (let i = 0; i < query.length; i++) {
    const end = skipComment(query, i);
    if (end !== i) {
      if (query.startsWith('/*', i) && !query.startsWith('/*', end)) {
        const close = query.indexOf('*/', i + 2);
        if (close === -1) {
          throw new Error('the query ends inside an unterminated comment');
        }
        i = close + 1;
        continue;
      }
      i = end - 1;
      continue;
    }
    const quote = query[i];
    if (quote === "'" || quote === '"' || quote === '`') {
      let next = i + 1;
      while (next < query.length) {
        if (query[next] === '\\') {
          next += 2;
          continue;
        }
        if (query[next] === quote) {
          if (query[next + 1] === quote) {
            next += 2;
            continue;
          }
          break;
        }
        next++;
      }
      if (next >= query.length) {
        throw new Error('the query ends inside an unterminated string');
      }
      i = next;
    }
  }
};

/** Inserts a piece of text at an offset, with single spaces on both sides. */
const splice = (query: string, at: number, insert: string, suffixStart = at): string => {
  // Only spaces and tabs are trimmed. Trimming the newline as well would join
  // the inserted text to a line comment that ends there, and the comment would
  // swallow it: `SELECT * FROM logs -- note\nLIMIT 10` would become
  // `SELECT * FROM logs -- note WHERE ... LIMIT 10`, which runs unfiltered.
  const prefix = query.slice(0, at).replace(/[ \t]+$/, '');
  const suffix = query.slice(suffixStart).replace(/^[ \t\r\n]+/, '');
  // A prefix that ends with a newline already separates the two, so nothing is
  // added: a newline before the insert would leave a blank line behind.
  const head = prefix.endsWith('\n') ? `${prefix}${insert}` : [prefix, insert].filter((p) => p !== '').join(' ');
  if (suffix === '') {
    return head;
  }
  // A line comment at the end of the inserted text runs to the end of its line,
  // so what follows it starts on a new line rather than behind the comment.
  return `${head}${endsWithLineComment(insert) ? '\n' : ' '}${suffix}`;
};

/** Reports whether the text ends with a `--` or `#` comment. */
const endsWithLineComment = (text: string): boolean => {
  const lastLineStart = text.lastIndexOf('\n') + 1;
  for (let i = lastLineStart; i < text.length; i++) {
    const end = skipComment(text, i);
    if (end !== i) {
      return end >= text.length;
    }
  }
  return false;
};

/** Reports whether a condition joins two branches at its own level with OR. */
const hasTopLevelOr = (condition: string): boolean => findTopLevelKeyword(condition, 'OR') !== -1;

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
    // Comments are skipped as well, so that a note between FROM and the table
    // name is not read as the table: `FROM -- c\ne2e-logs` reads `e2e-logs`.
    let moved = true;
    while (moved) {
      moved = false;
      while (i < query.length && /\s/.test(query[i])) {
        i++;
        moved = true;
      }
      const commentEnd = skipComment(query, i);
      if (commentEnd !== i) {
        i = commentEnd;
        moved = true;
      }
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

    // A keyword inside a comment is not a clause. Without this, `-- WHERE` or
    // `# LIMIT` in a note moves the insertion point into the comment.
    if (char === '-' && query[i + 1] === '-') {
      const newline = query.indexOf('\n', i);
      if (newline === -1) {
        return -1;
      }
      i = newline;
      continue;
    }
    if (char === '#') {
      const newline = query.indexOf('\n', i);
      if (newline === -1) {
        return -1;
      }
      i = newline;
      continue;
    }
    if (char === '/' && query[i + 1] === '*') {
      const close = query.indexOf('*/', i + 2);
      if (close === -1) {
        return -1;
      }
      i = close + 1;
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

    // The words of a clause can be separated by any run of whitespace, and a
    // clause can be followed directly by a parenthesis: `WHERE(...)` and
    // `ORDER\nBY service` are clauses as well.
    const before = i === 0 ? ' ' : query[i - 1];
    if (!/\s/.test(before)) {
      continue;
    }
    if (matchesKeywordAt(query, i, keyword)) {
      return i;
    }
  }

  return -1;
};

/**
 * Returns the offset where a comment that runs to the end of the query starts,
 * or the length of the query when it does not end with one. Inserting at the end
 * would put the text inside that comment, and the engine would ignore it.
 */
const beforeTrailingComment = (query: string): number => {
  // A comment marker inside a string literal or a quoted identifier is not a
  // comment, so the quotes are tracked while the query is scanned.
  let quote: string | null = null;
  let trailing = query.length;
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

    const end = skipComment(query, i);
    if (end === i) {
      continue;
    }
    if (end >= query.length) {
      trailing = i;
      break;
    }
    i = end - 1;
  }
  return trailing;
};

/**
 * Reports whether the keyword starts at the given offset, where the words of the
 * keyword may be separated by any run of whitespace and the keyword may be
 * followed directly by a parenthesis, as in `WHERE(status_code = 500)`.
 */
const matchesKeywordAt = (query: string, at: number, keyword: string): boolean => {
  let i = at;
  for (const char of keyword) {
    if (char === ' ') {
      // A single space in the keyword stands for any run of whitespace.
      if (i === at || !/\s/.test(query[i] ?? '')) {
        return false;
      }
      while (i < query.length && /\s/.test(query[i])) {
        i++;
      }
      continue;
    }
    if ((query[i] ?? '').toUpperCase() !== char) {
      return false;
    }
    i++;
  }

  const after = query[i] ?? ' ';
  return /[\s(]/.test(after);
};

/** Returns the offset of the first comment in the given text, or its length. */
const beforeComment = (text: string): number => {
  for (let i = 0; i < text.length; i++) {
    const end = skipComment(text, i);
    if (end !== i) {
      return i;
    }
  }
  return text.length;
};

/** Returns the offset just past a comment that starts at the given offset. */
const skipComment = (query: string, at: number): number => {
  if (query[at] === '-' && query[at + 1] === '-') {
    return lineEnd(query, at);
  }
  if (query[at] === '#') {
    return lineEnd(query, at);
  }
  if (query[at] === '/' && query[at + 1] === '*') {
    const close = query.indexOf('*/', at + 2);
    return close === -1 ? query.length : close + 2;
  }
  return at;
};

/** Returns the offset of the newline that ends the line the comment is on. */
const lineEnd = (query: string, at: number): number => {
  const newline = query.indexOf('\n', at);
  return newline === -1 ? query.length : newline + 1;
};
