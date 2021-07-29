import React, { PropsWithChildren } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { OpenSearchProvider } from '../components/QueryEditor/OpenSearchQueryContext';
import { useNextId } from './useNextId';
import { OpenSearchQuery } from '../types';

describe('useNextId', () => {
  it('Should return the next available id', () => {
    const query: OpenSearchQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'avg' }],
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };
    const wrapper = ({ children }: PropsWithChildren<{}>) => {
      return (
        <OpenSearchProvider query={query} datasource={{} as any} onChange={() => {}}>
          {children}
        </OpenSearchProvider>
      );
    };

    const { result } = renderHook(() => useNextId(), {
      wrapper,
    });

    expect(result.current).toBe('3');
  });
});
