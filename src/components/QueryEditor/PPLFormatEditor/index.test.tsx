import React from 'react';
import { shallow } from 'enzyme';
import { PPLFormatEditor } from './';
import { QueryEditorRow } from '../QueryEditorRow';
import { SettingsEditor } from './SettingsEditor';
import { OpenCloseButton } from './OpenCloseButton';
import { HelpMessage } from './HelpMessage';

jest.mock('../ElasticsearchQueryContext', () => ({
  useQuery: jest.fn(() => ({
    format: 'time_series',
  })),
}));

describe('PPLFormatEditor', () => {
  it('should render correctly', () => {
    shallow(<PPLFormatEditor />);
  });

  it('should render all components of PPL format editor row', () => {
    const wrapper = shallow(<PPLFormatEditor />);
    const queryEditorRow = wrapper.find(QueryEditorRow);
    expect(queryEditorRow.length).toBe(1);
    expect(queryEditorRow.props().label).toBe('Format');
    const settingsEditor = wrapper.find(SettingsEditor);
    expect(settingsEditor.props().value).toBe('time_series');
    expect(wrapper.find(OpenCloseButton).length).toBe(1);
    expect(wrapper.find(HelpMessage).length).toBe(0);
  });

  it('should show help message on click', () => {
    const wrapper = shallow(<PPLFormatEditor />);
    wrapper
      .find(OpenCloseButton)
      .props()
      .onClick();
    expect(wrapper.find(HelpMessage).length).toBe(1);
  });
});
