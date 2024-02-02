import { removeEmpty } from './utils';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'elastic25' };
      },
    };
  },
}));
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



