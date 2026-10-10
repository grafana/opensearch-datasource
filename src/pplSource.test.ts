import { getPPLFilterInsertionPoint, getPPLIndexSourceEnd } from './pplSource';

describe('getPPLFilterInsertionPoint', () => {
  it.each([
    ['source=logs', ' | head 2'],
    ['source=logs | eval category = upper(category)', ' | eventstats count() as total_count | sort seq | head 2'],
    ['source=logs | rename category as renamed', ' | fields renamed | head 2'],
    ['source=logs | stats count() as n by category', ' | where n > 0 | head 2'],
    ['source=logs | eventstats sum(seq) as amount', ' | head 2'],
    ['source=logs | unknown field', ' | head 2'],
  ])('does not cross the barrier in %s', (prefix, suffix) => {
    expect(getPPLFilterInsertionPoint(prefix + suffix, ['category'])).toBe(prefix.length);
  });

  it.each([
    'source=logs /* | head 2 */ | head 2',
    'source=logs | eval x = 1 /* | head 2 */ | head 2',
    'source=logs | eval x = 1 -- | head 2\n | head 2',
    'source=logs | eval x = 1 # | head 2\n | head 2',
    'source=logs | eval x = 1 // | head 2\n | head 2',
    'source=logs | where category = /foo|eval x|head 2/ | head 2',
    'source=logs | where exists [search source=other] | head 2',
    'source=logs | eval x = (1 | head 2',
    'source=logs | eval x = 1) | head 2',
    "source=logs | eval x = 'unfinished | head 2",
    'source=logs |',
    'multisearch [search source=a] [search source=b] | head 2',
  ])('declines an ambiguous query instead of moving predicates: %s', (query) => {
    expect(getPPLFilterInsertionPoint(query, ['category'])).toBeUndefined();
  });

  it('keeps filters after count when they refer to its output', () => {
    const prefix = 'source=logs | eventstats count() as total_count';
    expect(getPPLFilterInsertionPoint(prefix + ' | head 2', ['total_count'])).toBe(prefix.length);
  });
});

describe('getPPLIndexSourceEnd', () => {
  it.each([
    'source=logs',
    'index=logs',
    'search INDEX = logs-*',
    '  SEARCH source = logs-*',
    'source = cluster:logs-*',
    'source = logs-a, logs-b',
    'source = `logs|archive`',
    'source = "logs|archive"',
    "source = 'logs|archive'",
    'source = `logs``archive`',
    'source = "logs\\\"archive"',
  ])('recognizes %s without consuming the pipeline', (source) => {
    expect(getPPLIndexSourceEnd(source)).toBe(source.length);
    expect(getPPLIndexSourceEnd(source + '\n  | head 2')).toBe(source.length);
  });

  it.each([
    '',
    'source=',
    'source=logs,',
    'source=logs, | head 2',
    'source=`unterminated | head 2',
    'source="unterminated | head 2',
    'source=[search source=logs | head 2]',
    'multisearch [search source=a] [search source=b]',
    'describe logs',
    'source=logs /* comment | not a pipe */ | head 2',
    'source=logs category="B" | head 2',
  ])('does not guess a boundary for %s', (query) => {
    expect(getPPLIndexSourceEnd(query)).toBeUndefined();
  });
});
