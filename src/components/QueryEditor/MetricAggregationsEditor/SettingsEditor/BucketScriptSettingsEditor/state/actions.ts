import { createAction } from '@reduxjs/toolkit';
import {
  ADD_PIPELINE_VARIABLE,
  REMOVE_PIPELINE_VARIABLE,
  RENAME_PIPELINE_VARIABLE,
  CHANGE_PIPELINE_VARIABLE_METRIC,
} from './types';

export const addPipelineVariable = createAction(ADD_PIPELINE_VARIABLE);

export const removePipelineVariable = createAction<number>(REMOVE_PIPELINE_VARIABLE);

export const renamePipelineVariable = createAction<{ index: number; newName: string }>(RENAME_PIPELINE_VARIABLE);

export const changePipelineVariableMetric = createAction<{ index: number; newMetric: string }>(
  CHANGE_PIPELINE_VARIABLE_METRIC
);
