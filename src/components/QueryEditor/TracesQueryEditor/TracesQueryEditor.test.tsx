import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OpenSearchQuery } from 'types';
import { getDefaultTraceListQuery, getSingleTraceQuery } from './traceQueries';
import { TracesQueryEditor } from './TracesQueryEditor';

describe('TracesQueryEditor', () => {
  it('calls onChange with either a single trace id query or a trace list query depending on if a traceId is typed in the input field', async () => {
    const mockOnChange = jest.fn();
    const mockQuery: OpenSearchQuery = { refId: '1' };

    render(<TracesQueryEditor onChange={mockOnChange} query={mockQuery} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'someTraceId');

    await userEvent.tab();

    expect(mockOnChange.mock.calls[0][0]).toMatchObject(getSingleTraceQuery('someTraceId'));

    await userEvent.clear(screen.getByRole('textbox'));

    await userEvent.tab();

    expect(mockOnChange.mock.calls[1][0]).toMatchObject(getDefaultTraceListQuery());
  });
});
