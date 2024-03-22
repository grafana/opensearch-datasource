import { removeEmpty, enhanceDataFramesWithDataLinks } from './utils';

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
