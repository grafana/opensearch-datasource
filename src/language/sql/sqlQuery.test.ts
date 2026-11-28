import { applyTimeRangeToSQLQuery, getSQLIndex, replaceOrSetSQLIndex } from './sqlQuery';

describe('getSQLIndex', () => {
  it('reads the table of the FROM clause', () => {
    expect(getSQLIndex('SELECT * FROM e2e-logs LIMIT 10')).toBe('e2e-logs');
    expect(getSQLIndex('SELECT * FROM e2e-logs')).toBe('e2e-logs');
  });

  it('reads a quoted table without its quotes', () => {
    expect(getSQLIndex('SELECT * FROM `my-index` WHERE level = \'error\'')).toBe('my-index');
    expect(getSQLIndex('SELECT * FROM "my-index"')).toBe('my-index');
  });

  it('reads a table that a comment precedes', () => {
    expect(getSQLIndex('SELECT * FROM -- comment\ne2e-logs LIMIT 10')).toBe('e2e-logs');
    expect(getSQLIndex('SELECT * FROM /* comment */ e2e-logs')).toBe('e2e-logs');
    expect(getSQLIndex('SELECT * FROM e2e-logs -- LIMIT 10')).toBe('e2e-logs');
  });

  it('reads a table with a wildcard', () => {
    expect(getSQLIndex('SELECT * FROM logs-* LIMIT 10')).toBe('logs-*');
  });

  it('ignores a FROM inside a string literal or a function', () => {
    expect(getSQLIndex("SELECT 'from here' AS c FROM e2e-logs")).toBe('e2e-logs');
    expect(getSQLIndex('SELECT EXTRACT(YEAR FROM @timestamp) FROM e2e-logs')).toBe('e2e-logs');
  });

  it('reports no table when the query has no FROM clause', () => {
    expect(getSQLIndex('SELECT count(*)')).toBe('');
    expect(getSQLIndex('')).toBe('');
  });
});

describe('replaceOrSetSQLIndex', () => {
  it('replaces the table of the FROM clause and keeps the rest of the query', () => {
    expect(replaceOrSetSQLIndex('SELECT * FROM your_index LIMIT 10', 'e2e-logs')).toBe(
      'SELECT * FROM e2e-logs LIMIT 10'
    );
    expect(replaceOrSetSQLIndex("SELECT * FROM logs-2024 WHERE level = 'error'", 'e2e-logs')).toBe(
      "SELECT * FROM e2e-logs WHERE level = 'error'"
    );
  });

  it('replaces a quoted table', () => {
    expect(replaceOrSetSQLIndex('SELECT * FROM "old-index" WHERE level = \'error\'', 'e2e-logs')).toBe(
      "SELECT * FROM e2e-logs WHERE level = 'error'"
    );
    expect(replaceOrSetSQLIndex('SELECT * FROM `old-index` LIMIT 3', 'e2e-logs')).toBe(
      'SELECT * FROM e2e-logs LIMIT 3'
    );
  });

  it('replaces a table with a wildcard', () => {
    expect(replaceOrSetSQLIndex('SELECT * FROM logs-* LIMIT 10', 'e2e-logs')).toBe('SELECT * FROM e2e-logs LIMIT 10');
  });

  it('keeps a table alias', () => {
    expect(replaceOrSetSQLIndex('SELECT * FROM old_index t WHERE t.level = \'error\'', 'e2e-logs')).toBe(
      "SELECT * FROM e2e-logs t WHERE t.level = 'error'"
    );
  });

  it('leaves a FROM inside a string literal alone', () => {
    expect(replaceOrSetSQLIndex("SELECT 'from here' AS c FROM your_index", 'e2e-logs')).toBe(
      "SELECT 'from here' AS c FROM e2e-logs"
    );
  });

  it('adds a FROM clause to a query that has none', () => {
    expect(replaceOrSetSQLIndex('SELECT count(*)', 'e2e-logs')).toBe('SELECT count(*) FROM e2e-logs');
    expect(replaceOrSetSQLIndex('SELECT count(*) WHERE level = \'error\'', 'e2e-logs')).toBe(
      "SELECT count(*) FROM e2e-logs WHERE level = 'error'"
    );
  });

  it('starts a query from the picked index when there is no query', () => {
    expect(replaceOrSetSQLIndex('', 'e2e-logs')).toBe('SELECT * FROM e2e-logs LIMIT 10');
    expect(replaceOrSetSQLIndex('   ', 'e2e-logs')).toBe('SELECT * FROM e2e-logs LIMIT 10');
  });

  it('leaves a query whose table is a subquery alone', () => {
    // The table of a derived table is the subquery, which has its own FROM clause; rewriting
    // it would change the meaning of the query.
    expect(replaceOrSetSQLIndex('SELECT * FROM (SELECT * FROM logs-2024) t', 'e2e-logs')).toBe(
      'SELECT * FROM (SELECT * FROM logs-2024) t'
    );
  });
});

describe('applyTimeRangeToSQLQuery', () => {
  const from = '2026-06-01T00:00:00.000Z';
  const to = '2026-06-01T04:00:00.000Z';
  const filter = `\`@timestamp\` >= '${from}' AND \`@timestamp\` <= '${to}'`;

  it('adds a WHERE clause to a query that has none', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter}`
    );
  });

  it('adds the filter before a GROUP BY', () => {
    expect(applyTimeRangeToSQLQuery('SELECT service, COUNT(*) FROM logs GROUP BY service', '@timestamp', from, to)).toBe(
      `SELECT service, COUNT(*) FROM logs WHERE ${filter} GROUP BY service`
    );
  });

  it('adds the filter before an ORDER BY', () => {
    // The example the documentation shows for a SQL variable.
    expect(applyTimeRangeToSQLQuery('SELECT DISTINCT service FROM logs ORDER BY service', '@timestamp', from, to)).toBe(
      `SELECT DISTINCT service FROM logs WHERE ${filter} ORDER BY service`
    );
  });

  it('adds the filter before a LIMIT', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs LIMIT 10', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter} LIMIT 10`
    );
  });

  it('adds the filter before a HAVING', () => {
    expect(
      applyTimeRangeToSQLQuery(
        'SELECT service, COUNT(*) FROM logs GROUP BY service HAVING COUNT(*) > 1',
        '@timestamp',
        from,
        to
      )
    ).toBe(`SELECT service, COUNT(*) FROM logs WHERE ${filter} GROUP BY service HAVING COUNT(*) > 1`);
  });

  it('extends an existing WHERE clause before the clause that ends it', () => {
    expect(applyTimeRangeToSQLQuery("SELECT level, COUNT(*) FROM logs WHERE level = 'error' GROUP BY level", '@timestamp', from, to)).toBe(
      `SELECT level, COUNT(*) FROM logs WHERE level = 'error' AND ${filter} GROUP BY level`
    );
  });

  it('extends a WHERE clause that ends the query', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE status_code = 200', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE status_code = 200 AND ${filter}`
    );
  });

  it('groups an OR condition before adding the filter', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE a = 1 OR b = 2', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE (a = 1 OR b = 2) AND ${filter}`
    );
  });

  it('ignores a keyword that is not a clause', () => {
    expect(applyTimeRangeToSQLQuery("SELECT * FROM logs WHERE msg = 'order by me'", '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE msg = 'order by me' AND ${filter}`
    );
  });

  it('leaves the query alone when the data source has no time field', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs LIMIT 10', '', from, to)).toBe('SELECT * FROM logs LIMIT 10');
  });

  it('ignores a keyword inside a comment', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs -- WHERE level = 1\nLIMIT 10', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs -- WHERE level = 1\nWHERE ${filter} LIMIT 10`
    );
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs /* WHERE level = 1 */ LIMIT 10', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs /* WHERE level = 1 */ WHERE ${filter} LIMIT 10`
    );
  });

  it('does not insert the filter into a comment that ends the query', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs -- note', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter} -- note`
    );
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs # note', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter} # note`
    );
  });

  it('does not insert the filter into a comment after an existing WHERE clause', () => {
    // The WHERE branch has to skip a trailing comment as well, or the filter
    // becomes comment text and the query runs unfiltered.
    expect(
      applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE status_code = 500 -- note', '@timestamp', from, to)
    ).toBe(`SELECT * FROM logs WHERE status_code = 500 AND ${filter} -- note`);

    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE a = 1 OR b = 2 # note', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE (a = 1 OR b = 2) AND ${filter} # note`
    );
  });

  it('does not put a comment inside the parentheses that group an or condition', () => {
    // Grouping the condition includes everything up to the end of the clause. A
    // line comment in that range would swallow the closing parenthesis, so the
    // parentheses close before the comment and the comment stays outside.
    expect(
      applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE a = 1 OR b = 2 -- note\nLIMIT 3', '@timestamp', from, to)
    ).toBe(`SELECT * FROM logs WHERE (a = 1 OR b = 2) AND ${filter} -- note\nLIMIT 3`);

    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE a = 1 OR b = 2 # note', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE (a = 1 OR b = 2) AND ${filter} # note`
    );
  });

  it('strips every trailing semicolon, not just one', () => {
    // The Go backend strips all of them before it adds the filter, and the engine
    // rejects a query that has a statement terminator in the middle.
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs;;', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter}`
    );
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs; -- note', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter} -- note`
    );
  });

  it('refuses a query it cannot read to the end', () => {
    // The filter cannot be placed in a query with an unterminated comment, and
    // sending it unfiltered returns every document instead of the time range.
    expect(() => applyTimeRangeToSQLQuery('SELECT * FROM logs /* open', '@timestamp', from, to)).toThrow(
      'unterminated comment'
    );
    expect(() => applyTimeRangeToSQLQuery("SELECT * FROM logs WHERE a = 'open", '@timestamp', from, to)).toThrow(
      'unterminated string'
    );
  });

  it('does not take a comment marker inside a string literal for a comment', () => {
    // A literal that contains `--` or `/*` must survive unchanged; cutting the
    // query at that offset rewrites the literal and the engine rejects it.
    expect(applyTimeRangeToSQLQuery("SELECT 'a--b' AS c FROM logs", '@timestamp', from, to)).toBe(
      `SELECT 'a--b' AS c FROM logs WHERE ${filter}`
    );
    expect(applyTimeRangeToSQLQuery("SELECT '/*' AS c FROM logs", '@timestamp', from, to)).toBe(
      `SELECT '/*' AS c FROM logs WHERE ${filter}`
    );
    expect(applyTimeRangeToSQLQuery("SELECT * FROM logs WHERE c = 'a--b'", '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE c = 'a--b' AND ${filter}`
    );
  });

  it('reads a clause that is not separated by a space or a newline', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs WHERE(status_code = 500)', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE(status_code = 500) AND ${filter}`
    );
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs ORDER\nBY service', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter} ORDER\nBY service`
    );
    expect(applyTimeRangeToSQLQuery('SELECT service FROM logs GROUP  BY service', '@timestamp', from, to)).toBe(
      `SELECT service FROM logs WHERE ${filter} GROUP  BY service`
    );
  });

  it('drops a trailing semicolon', () => {
    expect(applyTimeRangeToSQLQuery('SELECT * FROM logs;', '@timestamp', from, to)).toBe(
      `SELECT * FROM logs WHERE ${filter}`
    );
  });
});
