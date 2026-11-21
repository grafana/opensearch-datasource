import { getSQLIndex, replaceOrSetSQLIndex } from './sqlQuery';

describe('getSQLIndex', () => {
  it('reads the table of the FROM clause', () => {
    expect(getSQLIndex('SELECT * FROM e2e-logs LIMIT 10')).toBe('e2e-logs');
    expect(getSQLIndex('SELECT * FROM e2e-logs')).toBe('e2e-logs');
  });

  it('reads a quoted table without its quotes', () => {
    expect(getSQLIndex('SELECT * FROM `my-index` WHERE level = \'error\'')).toBe('my-index');
    expect(getSQLIndex('SELECT * FROM "my-index"')).toBe('my-index');
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
