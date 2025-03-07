import { type Action, createAction } from '@reduxjs/toolkit';
import { initQuery } from '../state';
import { LuceneQueryType, OpenSearchQuery } from 'types';

export const UPDATE_LUCENE_TYPE_AND_METRICS = 'update_lucene_type_and_metrics';

export const updateLuceneTypeAndMetrics = createAction<{
  metrics: OpenSearchQuery['metrics'];
  luceneQueryType: OpenSearchQuery['luceneQueryType'];
}>(UPDATE_LUCENE_TYPE_AND_METRICS);

export const luceneQueryTypeReducer = (prevQueryType: OpenSearchQuery['luceneQueryType'], action: Action) => {
  if (updateLuceneTypeAndMetrics.match(action)) {
    return action.payload.luceneQueryType;
  }
  if (initQuery.match(action)) {
    return prevQueryType || LuceneQueryType.Metric;
  }

  return prevQueryType;
};
