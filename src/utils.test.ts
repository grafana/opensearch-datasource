import { removeEmpty, enhanceDataFramesWithDataLinks, memoizeAsync } from './utils';

describe('removeEmpty', () => {
  it('Should remove all empty', () => {
    const original = {
      stringsShouldBeKept: 'Something',
      unlessTheyAreEmpty: '',
      nullToBeRemoved: null,
      undefinedToBeRemoved: null,
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      emptyObjectsShouldBeRemoved: {},
      emptyArrayShouldBeRemoved: [],
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjToBeRemoved: {
        toBeRemoved: undefined,
      },
      nestedObjectToKeep: {
        thisShouldBeRemoved: null,
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    const expectedResult = {
      stringsShouldBeKept: 'Something',
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjectToKeep: {
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    expect(removeEmpty(original)).toStrictEqual(expectedResult);
  });
});

describe('enhanceDataFramesWithDataLinks', () => {
  it('should set an internal data link config for Trace List queries where the Trace Id field does not have an internal config set', () => {
    const dataQueryResponse = {
      data: [
        {
          name: 'Trace List',
          fields: [
            {
              name: 'Trace Id',
              config: {
                links: [{ title: 'Trace: ${__value.raw}' }],
              },
            },
            {
              name: 'Another Field',
              config: {
                links: [{ title: 'Trace: ${__value.raw}' }],
              },
            },
          ],
        },
      ],
    };

    const dsUid = 'dsUid';
    const dsName = 'dsName';
    const dsType = 'dsType';
    const enhancedDataFrames = enhanceDataFramesWithDataLinks(dataQueryResponse, [], dsUid, dsName, dsType);
    const traceIdFieldLinkConfig = enhancedDataFrames.data[0].fields[0].config.links?.[0];
    expect(traceIdFieldLinkConfig?.internal).toBeDefined();
  });

  it('should not set an internal data link config for non Trace List queries with a Trace Id field', () => {
    const dataQueryResponse = {
      data: [
        {
          name: 'Not a Trace List Query',
          fields: [
            {
              name: 'Trace Id',
              config: {
                links: [{ title: 'Trace: ${__value.raw}' }],
              },
            },
            {
              name: 'Another Field',
              config: {
                links: [{ title: 'Trace: ${__value.raw}' }],
              },
            },
          ],
        },
      ],
    };

    const dsUid = 'dsUid';
    const dsName = 'dsName';
    const dsType = 'dsType';
    const enhancedDataFrames = enhanceDataFramesWithDataLinks(dataQueryResponse, [], dsUid, dsName, dsType);
    const traceIdFieldLinkConfig = enhancedDataFrames.data[0].fields[0].config.links?.[0];
    expect(traceIdFieldLinkConfig?.internal).toBeUndefined();
  });
});

describe('memoizeAsync', () => {
  describe('memoizeAsync', () => {
    it('should cache the result for identical arguments', async () => {
      const spy = jest.fn(async (x: number) => {
        return x * 2;
      });

      const memoizedFn = memoizeAsync(spy);

      const result1 = await memoizedFn(2);
      const result2 = await memoizedFn(2);

      expect(result1).toBe(4);
      expect(result2).toBe(4);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not cache results for different arguments', async () => {
      const spy = jest.fn(async (x: number) => {
        return x * 2;
      });

      const memoizedFn = memoizeAsync(spy);

      await memoizedFn(1);
      await memoizedFn(2);

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should not cache rejected promises', async () => {
      const spy = jest.fn(async (x: number) => {
        if (x === 0) {
          throw new Error('fail');
        }
        return x;
      });

      const memoizedFn = memoizeAsync(spy);

      await expect(memoizedFn(0)).rejects.toThrow('fail');
      await expect(memoizedFn(0)).rejects.toThrow('fail');

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
  it('should delete first item in the cache when the cache size exceeds the limit', async () => {
    const spy = jest.fn(async (x: number) => {
      return x * 2;
    });

    const memoizedFn = memoizeAsync(spy, (x) => `key-${x}`, 2);

    await memoizedFn(1);
    // cache: { 'key-1': 2 }
    await memoizedFn(2);
    // cache: { 'key-1': 2, 'key-2': 4 }
    await memoizedFn(3);
    // cache: { 'key-2': 4, 'key-3': 6 }

    expect(spy).toHaveBeenCalledTimes(3);

    await memoizedFn(3);

    // cache: { 'key-2': 4, 'key-3': 6 }
    await memoizedFn(1); // calls the original function again

    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenLastCalledWith(1);
  });
});
