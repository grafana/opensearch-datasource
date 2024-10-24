import { createAction } from '@reduxjs/toolkit';
import { Filter } from '../../../aggregations';
import { ADD_FILTER, REMOVE_FILTER, CHANGE_FILTER } from './types';

export const addFilter = createAction(ADD_FILTER);

export const removeFilter = createAction<number>(REMOVE_FILTER);

export const changeFilter = createAction<{ index: number; filter: Filter }>(CHANGE_FILTER);
