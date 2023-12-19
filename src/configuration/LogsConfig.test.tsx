import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LogsConfig } from './LogsConfig';
import { createDefaultConfigOptions } from '__mocks__/DefaultConfigOptions';

describe('OpenSearchDetails', () => {
  it('should render without error', () => {
    render(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
  });

  it('should render fields', () => {
    render(<LogsConfig onChange={() => {}} value={createDefaultConfigOptions().jsonData} />);
    expect(screen.getByTestId('log-message-input')).toBeInTheDocument();
    expect(screen.getByTestId('field-name-input')).toBeInTheDocument(); 
  });

  it('should pass correct data to onChange', async () => {
    const onChangeMock = jest.fn();
    render(<LogsConfig onChange={onChangeMock} value={createDefaultConfigOptions().jsonData} />);
    await fireEvent.change(screen.getByTestId('log-message-input'), {target: {value: 'test_field'}});
    expect(onChangeMock.mock.calls[0][0].logMessageField).toBe('test_field');
  });
});
