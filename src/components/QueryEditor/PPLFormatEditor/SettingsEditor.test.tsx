import React from 'react';
import { SettingsEditor } from './SettingsEditor';
import { CHANGE_FORMAT } from './state';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import selectEvent from 'react-select-event';

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('SettingsEditor', () => {
  it('should render correctly', () => {
    render(<SettingsEditor value={'time_series'} />);
  });
  it('should dispatch action on change event', async () => {
    const expectedAction = {
      type: CHANGE_FORMAT,
      payload: 'time_series',
    };
    render(<SettingsEditor value={'table'} />);
    await userEvent.click(screen.getByText('Table'));
    const select = screen.getByTestId('settings-editor-wrapper');
    await selectEvent.select(select, 'Time series', { container: document.body });
    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
