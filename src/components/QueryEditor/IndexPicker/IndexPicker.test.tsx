import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchDatasource } from 'opensearchDatasource';
import { OpenSearchQuery, QueryType } from 'types';
import { OpenSearchProvider } from '../OpenSearchQueryContext';
import { IndexPicker } from './IndexPicker';

const mockDatasource = {
  getSupportedQueryTypes: () => [QueryType.Lucene, QueryType.PPL],
  getIndices: jest.fn().mockResolvedValue([
    { index: 'logs-2024', status: 'open', health: 'green', 'docs.count': '1000' },
    { index: 'metrics-2024', status: 'open', health: 'yellow', 'docs.count': '500' },
  ]),
  index: 'default-index',
  timeField: '@timestamp',
} as unknown as OpenSearchDatasource;

const createMockQuery = (overrides?: Partial<OpenSearchQuery>): OpenSearchQuery => ({
  refId: 'A',
  query: '',
  queryType: QueryType.Lucene,
  metrics: [{ type: 'count', id: '1' }],
  bucketAggs: [{ type: 'date_histogram', id: '2' }],
  ...overrides,
});

const renderIndexPicker = (query: OpenSearchQuery, onChange: jest.Mock) =>
  render(
    <OpenSearchProvider query={query} onChange={onChange} datasource={mockDatasource}>
      <IndexPicker query={query} onChange={onChange} />
    </OpenSearchProvider>
  );

describe('IndexPicker', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the "Select index" button', () => {
    const query = createMockQuery();
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    expect(screen.getByTestId('index-picker-button')).toBeInTheDocument();
    expect(screen.getByTestId('index-picker-button')).toHaveTextContent('Select index');
  });

  it('shows selected index as a pill for Lucene query with query.index set', () => {
    const query = createMockQuery({ index: 'my-override' });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    const pill = screen.getByTestId('index-picker-selected');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('my-override');
  });

  it('shows datasource default index as pill when query.index is undefined (Lucene)', () => {
    const query = createMockQuery({ index: undefined });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    const pill = screen.getByTestId('index-picker-selected');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('default-index');
  });

  it('parses and shows PPL source index in pill', () => {
    const query = createMockQuery({
      queryType: QueryType.PPL,
      query: 'source = my-ppl-index | fields *',
    });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    const pill = screen.getByTestId('index-picker-selected');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('my-ppl-index');
  });

  it('opens modal when button is clicked', async () => {
    const query = createMockQuery();
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    await userEvent.click(screen.getByTestId('index-picker-button'));

    await waitFor(() => {
      expect(screen.getByTestId('index-picker-search')).toBeInTheDocument();
    });
  });

  it('calls onChange with correct Lucene query when index is selected via modal', async () => {
    const query = createMockQuery();
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    // Open the modal
    await userEvent.click(screen.getByTestId('index-picker-button'));

    // Wait for indices to load
    await waitFor(() => {
      expect(mockDatasource.getIndices).toHaveBeenCalled();
    });

    // Click the logs-2024 row to select it
    const row = await screen.findByTestId('index-row-logs-2024');
    await userEvent.click(row);

    // Confirm selection
    await userEvent.click(screen.getByTestId('modal-select'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...query,
        index: 'logs-2024',
      })
    );
  });

  it('calls onChange with correct PPL query when index is selected via modal', async () => {
    const query = createMockQuery({
      queryType: QueryType.PPL,
      query: 'source = old-index | fields *',
    });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    // Open the modal
    await userEvent.click(screen.getByTestId('index-picker-button'));

    // Wait for indices to load
    await waitFor(() => {
      expect(mockDatasource.getIndices).toHaveBeenCalled();
    });

    // Click the metrics-2024 row to select it
    const row = await screen.findByTestId('index-row-metrics-2024');
    await userEvent.click(row);

    // Confirm selection
    await userEvent.click(screen.getByTestId('modal-select'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'source = metrics-2024 | fields *',
        index: 'metrics-2024',
      })
    );
  });

  it('clears the pill for Lucene query and calls onChange with index: undefined', async () => {
    const query = createMockQuery({ index: 'logs-2024' });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    const clearButton = screen.getByTestId('index-picker-clear');
    await userEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...query,
        index: undefined,
      })
    );
  });

  it('clears PPL query index and reverts to datasource default when datasource has a default index', async () => {
    const query = createMockQuery({
      queryType: QueryType.PPL,
      query: 'source = my-ppl-index | fields *',
      index: 'my-ppl-index',
    });
    const onChange = jest.fn();

    renderIndexPicker(query, onChange);

    const clearButton = screen.getByTestId('index-picker-clear');
    await userEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'source = default-index | fields *',
        index: undefined,
      })
    );
  });

  it('clears PPL query index and reverts to your_index placeholder when datasource has no default index', async () => {
    const datasourceWithNoDefault = { ...mockDatasource, index: '' } as unknown as OpenSearchDatasource;
    const query = createMockQuery({
      queryType: QueryType.PPL,
      query: 'source = my-ppl-index | fields *',
      index: 'my-ppl-index',
    });
    const onChange = jest.fn();

    render(
      <OpenSearchProvider query={query} onChange={onChange} datasource={datasourceWithNoDefault}>
        <IndexPicker query={query} onChange={onChange} />
      </OpenSearchProvider>
    );

    const clearButton = screen.getByTestId('index-picker-clear');
    await userEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'source = your_index | fields *',
        index: undefined,
      })
    );
  });
});
