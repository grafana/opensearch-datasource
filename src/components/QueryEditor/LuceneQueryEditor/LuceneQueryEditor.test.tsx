import { DataSourcePluginMeta } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchDatasource } from 'opensearchDatasource';
import React from 'react';
import { Flavor, LuceneQueryType, OpenSearchQuery } from 'types';
import { OpenSearchProvider } from '../OpenSearchQueryContext';
import { LuceneQueryEditor } from './LuceneQueryEditor';
import { MetricAggregation } from '../MetricAggregationsEditor/aggregations';
import { Histogram } from '../BucketAggregationsEditor/aggregations';

const createMockQuery = (overrides?: Partial<OpenSearchQuery>): OpenSearchQuery => ({
  refId: '1',
  metrics: [
    {
      id: '1',
      type: 'count',
    } as MetricAggregation,
  ],
  bucketAggs: [
    {
      id: '1',
      type: 'histogram',
      settings: {
        interval: '',
        min_doc_count: '',
      },
    } as Histogram,
  ],
  query: 'query',
  ...(overrides ? overrides : {}),
});
const createMockOnChange = () => jest.fn();
const createMockDatasource = () =>
  new OpenSearchDatasource({
    id: 123,
    uid: '123',
    type: '',
    name: '',
    meta: {} as DataSourcePluginMeta,
    jsonData: {
      database: '',
      timeField: '',
      version: '',
      flavor: Flavor.OpenSearch,
      timeInterval: '',
    },
    access: 'direct',
    readOnly: false,
  });

describe('LuceneQueryEditor', () => {
  it('renders a metric aggregations editor when the query is a metrics query', async () => {
    const mockQuery = createMockQuery();
    const mockOnChange = createMockOnChange();
    const mockDatasource = createMockDatasource();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByText('Metric')).toBeInTheDocument();
    expect(screen.queryByText('Traces')).not.toBeInTheDocument();
  });

  it('renders the traces query editor when traces is selected', async () => {
    const mockQuery = createMockQuery();
    const mockOnChange = createMockOnChange();
    const mockDatasource = createMockDatasource();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByText('Metric')).toBeInTheDocument();
    expect(screen.queryByText('Traces')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Metric'));
    expect(screen.queryByText('Traces')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Traces'));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange.mock.calls[0][0].luceneQueryType).toBe('Traces');
  });

  it('renders the size field when traces is selected', async () => {
    const mockQuery = createMockQuery();
    mockQuery.luceneQueryType = LuceneQueryType.Traces;
    const mockOnChange = createMockOnChange();
    const mockDatasource = createMockDatasource();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    const limitElement = screen.getByTestId('span-limit-input');
    expect(limitElement).toBeInTheDocument();
    await userEvent.type(limitElement!, '200');
    fireEvent.blur(limitElement!);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange.mock.calls[0][0].tracesSize).toBe('200');
  });

  it('renders the service map switch and size field when traces is selected', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.Traces,
    });
    const mockOnChange = createMockOnChange();
    const mockDatasource = createMockDatasource();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByText('Service Map')).toBeInTheDocument();
    expect(screen.queryByText('Size')).toBeInTheDocument();
    jest.clearAllMocks();
  });
  it('does not render the size input if service map is selected', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.Traces,
      serviceMap: true,
    });
    const mockOnChange = createMockOnChange();
    const mockDatasource = createMockDatasource();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByText('Service Map')).toBeInTheDocument();
    // Size should not be rendered if service map is selected
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
    jest.clearAllMocks();
  });
});
