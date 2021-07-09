import React from 'react';
import { shallow } from 'enzyme';
import { SettingsEditor } from './SettingsEditor';
import { Segment } from '@grafana/ui';
import { CHANGE_FORMAT, ChangeFormatAction } from './state';

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('SettingsEditor', () => {
  it('should render correctly', () => {
    shallow(<SettingsEditor value={'time_series'} />);
  });

  it('should dispatch action on change event', () => {
    const expectedAction: ChangeFormatAction = {
      type: CHANGE_FORMAT,
      payload: { format: 'time_series' },
    };
    const wrapper = shallow(<SettingsEditor value={'table'} />);
    wrapper.find(Segment).simulate('change', { value: 'time_series' });
    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
