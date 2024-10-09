import { toUtc, dateTime, DateTime } from '@grafana/data';

const intervalMap: any = {
  Hourly: { startOf: 'hour', amount: 'hours' },
  Daily: { startOf: 'day', amount: 'days' },
  Weekly: { startOf: 'isoWeek', amount: 'weeks' },
  Monthly: { startOf: 'month', amount: 'months' },
  Yearly: { startOf: 'year', amount: 'years' },
};

export class IndexPattern {
  private dateLocale = 'en';

  constructor(private pattern: any, private interval?: string) {}

  getIndexForToday() {
    if (this.interval) {
      return toUtc().locale(this.dateLocale).format(this.pattern);
    } else {
      return this.pattern;
    }
  }

  getIndexList(from?: DateTime, to?: DateTime) {
    // When no `from` or `to` is provided, we request data from 7 subsequent/previous indices
    // for the provided index pattern.
    // This is useful when requesting log context where the only time data we have is the log
    // timestamp.
    const indexOffset = 7;
    if (!this.interval) {
      return this.pattern;
    }

    const intervalInfo = intervalMap[this.interval];
    const start = dateTime(from || dateTime(to).add(-indexOffset, intervalInfo.amount))
      .utc()
      .startOf(intervalInfo.startOf);
    const endEpoch = dateTime(to || dateTime(from).add(indexOffset, intervalInfo.amount))
      .utc()
      .startOf(intervalInfo.startOf)
      .valueOf();
    const indexList = [];

    while (start.valueOf() <= endEpoch) {
      indexList.push(start.locale(this.dateLocale).format(this.pattern));
      start.add(1, intervalInfo.amount);
    }

    return indexList;
  }

  getPPLIndexPattern() {
    // PPL currently does not support multi-indexing through lists, so a wildcard
    // pattern is used to match all patterns and relies on the time range filter
    // to filter out the incorrect indexes.
    if (!this.interval) {
      return this.pattern;
    }

    let indexPattern = this.pattern.match(/\[(.*?)\]/)[1];

    if (this.pattern.startsWith('[')) {
      indexPattern = indexPattern + '*';
    } else if (this.pattern.endsWith(']')) {
      indexPattern = '*' + indexPattern;
    }
    return indexPattern;
  }
}
