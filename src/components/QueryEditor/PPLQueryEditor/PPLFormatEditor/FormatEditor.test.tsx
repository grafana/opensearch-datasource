import React from 'react';
import { CHANGE_FORMAT } from './state';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormatEditor } from './FormatEditor';

const mockDispatch = jest.fn();

jest.mock('../../../../hooks/useStatelessReducer', () => ({
  useDispatch: jest.fn(() => mockDispatch),
}));

describe('SettingsEditor', () => {
  it('should render correctly', () => {
    render(<FormatEditor format="time_series" />);
  });
  it('should dispatch action on change event', async () => {
    const expectedAction = {
      type: CHANGE_FORMAT,
      payload: 'time_series',
    };
    render(<FormatEditor format="table" />);
    const format = screen.getByTestId('format-select');
    await userEvent.click(format);
    await userEvent.click(screen.getByRole('option', { name: 'Time series' }));
    expect(mockDispatch).toHaveBeenCalledWith(expectedAction);
  });
});
