import { DataSourcePluginMeta } from '@grafana/data';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OpenSearchDatasource } from 'datasource';
import React from 'react';
import { Flavor, LuceneQueryType, OpenSearchQuery } from 'types';
import { OpenSearchProvider } from '../OpenSearchQueryContext';
import { LuceneQueryEditor } from './LuceneQueryEditor';
import { MetricAggregation } from '../MetricAggregationsEditor/aggregations';
import { Histogram } from '../BucketAggregationsEditor/aggregations';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    featureToggles: {
      openSearchNodeGraph: true,
    },
  },
}));

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

  it('renders the service map switch when traces is selected', async () => {
    jest.mock('@grafana/runtime', () => ({
      ...jest.requireActual('@grafana/runtime'),
      config: {
        featureToggles: {
          openSearchNodeGraph: true,
        },
      },
    }));
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
    jest.clearAllMocks();
  });
});
