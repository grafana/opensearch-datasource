import React from 'react';
import { shallow } from 'enzyme';
import { QueryTypeEditor } from './';
import { Segment } from '@grafana/ui';
import { ElasticsearchQueryType } from '../../../types';
import { CHANGE_QUERY_TYPE, ChangeQueryTypeAction } from './state';

const mockDatasource = {
  getSupportedQueryTypes: () => [ElasticsearchQueryType.Lucene, ElasticsearchQueryType.PPL],
};

jest.mock('../ElasticsearchQueryContext', () => ({
  useDatasource: jest.fn(() => mockDatasource),
}));

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('QueryTypeEditor', () => {
  it('should render correctly', () => {
    shallow(<QueryTypeEditor value={ElasticsearchQueryType.Lucene} />);
  });

  it('should dispatch action on change event', () => {
    const expectedAction: ChangeQueryTypeAction = {
      type: CHANGE_QUERY_TYPE,
      payload: { queryType: ElasticsearchQueryType.Lucene },
    };
    const wrapper = shallow(<QueryTypeEditor value={ElasticsearchQueryType.PPL} />);
    wrapper.find(Segment).simulate('change', { value: ElasticsearchQueryType.Lucene });
    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
