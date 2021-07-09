import React from 'react';
import { shallow } from 'enzyme';
import { PPLEditor } from './PPLEditor';
import { QueryField } from '@grafana/ui';
import { QueryTypeEditor } from './QueryTypeEditor';
import { PPLFormatEditor } from './PPLFormatEditor';
import { ElasticsearchQuery } from '../../types';

jest.mock('../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(),
}));

describe('PPLEditor', () => {
  const queryString: ElasticsearchQuery['query'] = '';

  it('should render correctly', () => {
    shallow(<PPLEditor query={queryString} />);
  });

  it('should render all components of PPL query editor', () => {
    const wrapper = shallow(<PPLEditor query={queryString} />);
    const queryField = wrapper.find(QueryField);
    expect(queryField.length).toBe(1);
    expect(queryField.prop('query')).toBe(queryString);
    expect(wrapper.find(QueryTypeEditor).length).toBe(1);
    expect(wrapper.find(PPLFormatEditor).length).toBe(1);
  });
});
