import React from 'react';
import { shallow } from 'enzyme';
import { OpenCloseButton } from './OpenCloseButton';

const onClickMock = jest.fn();

describe('OpenCloseButton', () => {
  it('should render correctly', () => {
    shallow(<OpenCloseButton label="label" open={true} onClick={onClickMock} />);
  });

  it('should call onClick when button is clicked', () => {
    const wrapper = shallow(<OpenCloseButton label="label" open={true} onClick={onClickMock} />);
    wrapper.find('button').simulate('click');
    expect(onClickMock).toBeCalled();
  });
});
