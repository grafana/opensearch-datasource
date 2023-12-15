import React from 'react';
import { SettingsEditor } from './SettingsEditor';
import { CHANGE_FORMAT, ChangeFormatAction } from './state';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockDispatch = jest.fn();

jest.mock('../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('SettingsEditor', () => {
  it('should render correctly', () => {
    render(<SettingsEditor value={'time_series'} />);
  });

  it('should dispatch action on change event', async () => {
    const expectedAction: ChangeFormatAction = {
      type: CHANGE_FORMAT,
      payload: { format: 'time_series' },
    };
    render(<SettingsEditor value={'table'} />);
    await userEvent.click(screen.getByText('Table'));
    waitFor(() => {
      screen.getByText('Time series');
      fireEvent.change(screen.getByTestId('settings-editor'), { target: { value: 'time_series' } });
      expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
    });
  });
});
