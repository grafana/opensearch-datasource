import React from 'react';
import { OpenCloseButton } from './OpenCloseButton';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const onClickMock = jest.fn();

describe('OpenCloseButton', () => {
  it('should render correctly', () => {
    render(<OpenCloseButton label="label" open={true} onClick={onClickMock} />);
  });

  it('should call onClick when button is clicked', async () => {
    render(<OpenCloseButton label="label" open={true} onClick={onClickMock} />);
    await userEvent.click(screen.getByTestId('open-close-button'));
    expect(onClickMock).toHaveBeenCalled();
  });
});
