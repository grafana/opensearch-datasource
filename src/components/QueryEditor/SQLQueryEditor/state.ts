import { type Action, createAction } from '@reduxjs/toolkit';
import { initQuery } from '../state';

export const CHANGE_USE_TIME_RANGE = 'change_use_time_range';

export const changeUseTimeRange = createAction<boolean>(CHANGE_USE_TIME_RANGE);

export const useTimeRangeReducer = (prevUseTimeRange: boolean | undefined, action: Action) => {
  if (changeUseTimeRange.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    return true;
  }

  return prevUseTimeRange;
};
