import { createAction } from '@reduxjs/toolkit';
import { OpenSearchQuery } from 'types';
import { Action } from '../../../hooks/useStatelessReducer';
import { initQuery } from '../state';

export const CHANGE_FORMAT = 'change_format';

export const changeFormat = createAction<OpenSearchQuery['format']>(CHANGE_FORMAT);

export const formatReducer = (prevFormat: OpenSearchQuery['format'], action: Action) => {
  if (changeFormat.match(action)) {
    return action.payload;
  }
  if (initQuery.match(action)) {
    return 'table';
  }

  return prevFormat;
};
