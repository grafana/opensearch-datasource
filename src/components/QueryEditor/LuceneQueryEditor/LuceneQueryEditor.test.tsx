import React from 'react';
import { DataSourcePluginMeta } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchDatasource } from 'opensearchDatasource';
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
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockOnChange = createMockOnChange();
  const mockDatasource = createMockDatasource();
  it('renders a metric aggregations editor when the query is a metrics query', async () => {
    const mockQuery = createMockQuery();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByText('Metric (1)')).toBeInTheDocument();
    expect(screen.queryByText('Service Map')).not.toBeInTheDocument();
  });

  it('renders the traces query editor when traces is selected', async () => {
    const mockQuery = createMockQuery();

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.getByText('Metric (1)')).toBeInTheDocument();
    expect(screen.queryByText('Service Map')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Traces'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange.mock.calls[0][0].luceneQueryType).toBe('Traces');
  });

  it('renders the size field when traces is selected', async () => {
    const mockQuery = createMockQuery();
    mockQuery.luceneQueryType = LuceneQueryType.Traces;

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

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.getByText('Service Map')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
  });
  it('does not render the size input if service map is selected', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.Traces,
      serviceMap: true,
    });

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.getByText('Service Map')).toBeInTheDocument();
    // Size should not be rendered if service map is selected
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });

  it('should render the size field if Logs query is selected', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.Logs,
      metrics: [{ type: 'logs', id: 'abc' }],
    });

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );
    await userEvent.click(screen.getByTestId('settings-button'));
    expect(screen.getByText('Size')).toBeInTheDocument();
  });

  it('should render raw data setting if Raw Data query is selected', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.RawData,
      metrics: [{ type: 'raw_data', id: 'abc', settings: { useTimeRange: true } }],
    });

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );
    await userEvent.click(screen.getByTestId('settings-button'));
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Use time range')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
  });

  it('should not render order setting if Raw Data query is selected and useTimeRange is false', async () => {
    const mockQuery = createMockQuery({
      luceneQueryType: LuceneQueryType.RawData,
      metrics: [{ type: 'raw_data', id: 'abc', settings: { useTimeRange: false } }],
    });

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    await userEvent.click(screen.getByTestId('settings-button'));
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Use time range')).toBeInTheDocument();
    expect(screen.queryByText('Order')).not.toBeInTheDocument();
  });

  it('Should NOT show Bucket Aggregations Editor if query contains a "singleMetric" metric', () => {
    const mockQuery: OpenSearchQuery = {
      refId: 'A',
      query: '',
      metrics: [
        {
          id: '1',
          type: 'logs',
        },
      ],
      // Even if present, this shouldn't be shown in the UI
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.queryByLabelText('Group By')).not.toBeInTheDocument();
  });

  it('Should show Bucket Aggregations Editor if query does NOT contains a "singleMetric" metric', () => {
    const mockQuery: OpenSearchQuery = {
      refId: 'A',
      query: '',
      metrics: [
        {
          id: '1',
          type: 'avg',
        },
      ],
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };

    render(
      <OpenSearchProvider query={mockQuery} onChange={mockOnChange} datasource={mockDatasource}>
        <LuceneQueryEditor query={mockQuery} onChange={mockOnChange} />
      </OpenSearchProvider>
    );

    expect(screen.getByText('Group By')).toBeInTheDocument();
  });
});
