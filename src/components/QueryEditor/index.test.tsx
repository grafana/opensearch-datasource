import React from 'react';
import { shallow } from 'enzyme';
import { QueryEditorForm } from './';
import { LuceneEditor } from './LuceneEditor';
import { PPLEditor } from './PPLEditor';
import { ElasticsearchQuery, ElasticsearchQueryType } from '../../types';

describe('QueryEditorForm', () => {
  it('should render LuceneEditor when queryType is not set', () => {
    const query: ElasticsearchQuery = {
      refId: 'A',
    };
    const wrapper = shallow(<QueryEditorForm value={query} />);
    expect(wrapper.find(LuceneEditor).length).toBe(1);
    expect(wrapper.find(PPLEditor).length).toBe(0);
  });

  it('should render LuceneEditor given Lucene queryType', () => {
    const luceneQuery: ElasticsearchQuery = {
      refId: 'A',
      queryType: ElasticsearchQueryType.Lucene,
    };
    const wrapper = shallow(<QueryEditorForm value={luceneQuery} />);
    expect(wrapper.find(LuceneEditor).length).toBe(1);
    expect(wrapper.find(PPLEditor).length).toBe(0);
  });

  it('should render PPLEditor given PPL queryType', () => {
    const pplQuery: ElasticsearchQuery = {
      refId: 'A',
      queryType: ElasticsearchQueryType.PPL,
    };
    const wrapper = shallow(<QueryEditorForm value={pplQuery} />);
    expect(wrapper.find(LuceneEditor).length).toBe(0);
    expect(wrapper.find(PPLEditor).length).toBe(1);
  });
});
