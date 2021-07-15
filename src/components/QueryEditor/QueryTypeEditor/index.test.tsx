import React from 'react';
import { shallow } from 'enzyme';
import { QueryTypeEditor } from './';
import { Segment } from '@grafana/ui';
import { QueryType } from '../../../types';
import { CHANGE_QUERY_TYPE, ChangeQueryTypeAction } from './state';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
};

jest.mock('../OpenSearchQueryContext', () => ({
  useDatasource: jest.fn(() => mockDatasource),
}));

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('QueryTypeEditor', () => {
  it('should render correctly', () => {
    shallow(<QueryTypeEditor value={QueryType.Lucene} />);
  });

  it('should dispatch action on change event', () => {
    const expectedAction: ChangeQueryTypeAction = {
      type: CHANGE_QUERY_TYPE,
      payload: { queryType: QueryType.Lucene },
    };
    const wrapper = shallow(<QueryTypeEditor value={QueryType.PPL} />);
    wrapper.find(Segment).simulate('change', { value: QueryType.Lucene });
    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
