import React from 'react';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    render(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
  });

  it('should render fields', () => {
    render(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
    expect(screen.getByTestId('log-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('field-name-input')).toBeInTheDocument(); 
  });

  it('should pass correct data to onChange', () => {
    const onChangeMock = jest.fn();
    render(<LogsConfig onChange={onChangeMock} value={createDefaultConfigOptions().jsonData} />);
    userEvent.type(screen.getByTestId('log-message-input'), 'test_field');
    waitFor(() => {
      expect(onChangeMock.mock.calls[0][0].logMessageField).toBe('test_field');
    });
  });
});
