import { Action } from '../../../hooks/useStatelessReducer';
import { INIT, InitAction } from '../state';
import { PPLFormatType } from './formats';

export const CHANGE_FORMAT = 'change_format';

export interface ChangeFormatAction extends Action<typeof CHANGE_FORMAT> {
  payload: {
    format: PPLFormatType;
  };
}

export const changeFormat = (format: PPLFormatType): ChangeFormatAction => ({
  type: CHANGE_FORMAT,
  payload: {
    format,
  },
});

export const formatReducer = (prevFormat: PPLFormatType, action: ChangeFormatAction | InitAction) => {
  switch (action.type) {
    case CHANGE_FORMAT:
      return action.payload.format;

    case INIT:
      return 'table';

    default:
      return prevFormat;
  }
};
