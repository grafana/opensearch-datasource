import { reducerTester } from '../../../../../../reducerTester';
import { PipelineVariable } from '../../../aggregations';
import {
  addPipelineVariable,
  changePipelineVariableMetric,
  removePipelineVariable,
  renamePipelineVariable,
} from './actions';
import { reducer } from './reducer';

describe('BucketScript Settings Reducer', () => {
  it('Should correctly add new pipeline variable', () => {
    const expectedPipelineVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [])
      .whenActionIsDispatched(addPipelineVariable())
      .thenStateShouldEqual([expectedPipelineVar]);
  });

  it('Should correctly remove pipeline variables', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: '',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(removePipelineVariable(0))
      .thenStateShouldEqual([secondVar]);
  });

  it('Should correctly rename pipeline variable', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: '',
    };

    const expectedSecondVar: PipelineVariable = {
      ...secondVar,
      name: 'new name',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(renamePipelineVariable({ newName: expectedSecondVar.name, index: 1 }))
      .thenStateShouldEqual([firstVar, expectedSecondVar]);
  });

  it('Should correctly change pipeline variable target metric', () => {
    const firstVar: PipelineVariable = {
      name: 'var1',
      pipelineAgg: '',
    };

    const secondVar: PipelineVariable = {
      name: 'var2',
      pipelineAgg: 'some agg',
    };

    const expectedSecondVar: PipelineVariable = {
      ...secondVar,
      pipelineAgg: 'some new agg',
    };

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, [firstVar, secondVar])
      .whenActionIsDispatched(changePipelineVariableMetric({ newMetric: expectedSecondVar.pipelineAgg, index: 1 }))
      .thenStateShouldEqual([firstVar, expectedSecondVar]);
  });

  it('Should not change state with other action types', () => {
    const initialState: PipelineVariable[] = [
      {
        name: 'var1',
        pipelineAgg: '1',
      },
      {
        name: 'var2',
        pipelineAgg: '2',
      },
    ];

    reducerTester<PipelineVariable[]>()
      .givenReducer(reducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
