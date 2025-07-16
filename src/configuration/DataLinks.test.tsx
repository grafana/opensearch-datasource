import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataLinks } from './DataLinks';

// Slate dependency is quite outdated and causes issues with the current jsDom version. Once it's removed from grafana/ui, we can remove this.
// https://github.com/grafana/grafana/issues/98920
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  DataLinkInput: jest.fn().mockReturnValue(<input />),
}));
describe('DataLinks', () => {
  let originalGetSelection: typeof window.getSelection;
  beforeAll(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = () => null;
  });

  afterAll(() => {
    window.getSelection = originalGetSelection;
  });

  it('renders correctly when no fields', async () => {
    render(<DataLinks onChange={() => {}} />);
    expect(screen.getByTestId('button-add')).toBeInTheDocument();
    expect(screen.queryByText('Field')).not.toBeInTheDocument();
  });

  it('renders correctly when there are fields', async () => {
    render(<DataLinks value={testValue} onChange={() => {}} />);
    await userEvent.click(screen.getByTestId('button-add'));
    expect(screen.getByTestId('button-add')).toBeInTheDocument();
    expect(screen.getAllByText('Field').length).toBe(2);
  });

  it('adds new field', async () => {
    const onChangeMock = jest.fn();
    render(<DataLinks onChange={onChangeMock} />);
    await userEvent.click(screen.getByTestId('button-add'));
    expect(onChangeMock.mock.calls[0][0].length).toBe(1);
  });

  it('removes field', async () => {
    const onChangeMock = jest.fn();
    render(<DataLinks value={testValue} onChange={onChangeMock} />);
    await userEvent.click(screen.getByTestId('remove-button-regex1'));
    const newValue = onChangeMock.mock.calls[0][0];
    expect(newValue.length).toBe(1);
    expect(newValue[0]).toMatchObject({
      field: 'regex2',
      url: 'localhost2',
    });
  });
});

const testValue = [
  {
    field: 'regex1',
    url: 'localhost1',
  },
  {
    field: 'regex2',
    url: 'localhost2',
  },
];
