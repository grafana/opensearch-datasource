import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndexPickerModal } from './IndexPickerModal';
import { OpenSearchIndex } from 'types';

const mockIndices: OpenSearchIndex[] = [
  { index: 'logs-2024', status: 'open', health: 'green', 'docs.count': '1000' },
  { index: 'metrics-2024', status: 'open', health: 'yellow', 'docs.count': '500' },
  { index: 'traces-2024', status: 'open', health: 'red', 'docs.count': '250' },
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSelect: jest.fn(),
  currentIndex: '',
  indices: mockIndices,
  loading: false,
  onFetchIndices: jest.fn(),
};

const renderModal = (overrides?: Partial<typeof defaultProps>) =>
  render(<IndexPickerModal {...defaultProps} {...overrides} />);

describe('IndexPickerModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByText('Select index')).not.toBeInTheDocument();
  });

  it('renders modal title "Select index" when isOpen is true', () => {
    renderModal();

    expect(screen.getByText('Select index')).toBeInTheDocument();
  });

  it('calls onFetchIndices when opened', () => {
    renderModal();

    expect(defaultProps.onFetchIndices).toHaveBeenCalled();
  });

  it('shows loading indicator when loading is true', () => {
    renderModal({ loading: true, indices: [] });

    // The modal should show a loading state (Spinner or loading text)
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders index names in table when indices are provided', () => {
    renderModal();

    expect(screen.getByTestId('index-row-logs-2024')).toBeInTheDocument();
    expect(screen.getByTestId('index-row-metrics-2024')).toBeInTheDocument();
    expect(screen.getByTestId('index-row-traces-2024')).toBeInTheDocument();

    expect(screen.getByText('logs-2024')).toBeInTheDocument();
    expect(screen.getByText('metrics-2024')).toBeInTheDocument();
    expect(screen.getByText('traces-2024')).toBeInTheDocument();
  });

  it('filters indices when search input is changed', async () => {
    renderModal();

    const searchInput = screen.getByTestId('index-picker-search');
    await userEvent.type(searchInput, 'logs');

    expect(screen.getByTestId('index-row-logs-2024')).toBeInTheDocument();
    expect(screen.queryByTestId('index-row-metrics-2024')).not.toBeInTheDocument();
    expect(screen.queryByTestId('index-row-traces-2024')).not.toBeInTheDocument();
  });

  it('shows "No indices found" when no indices match filter', async () => {
    renderModal();

    const searchInput = screen.getByTestId('index-picker-search');
    await userEvent.type(searchInput, 'nonexistent');

    expect(screen.getByText('No indices found')).toBeInTheDocument();
  });

  it('shows "No indices found" when indices array is empty and not loading', () => {
    renderModal({ indices: [], loading: false });

    expect(screen.getByText('No indices found')).toBeInTheDocument();
  });

  it('pre-selects the currentIndex row', () => {
    renderModal({ currentIndex: 'metrics-2024' });

    const row = screen.getByTestId('index-row-metrics-2024');
    const radio = row.querySelector('input[type="radio"]');
    expect(radio).toBeChecked();
  });

  it('changes the pending selection when a row is clicked', async () => {
    renderModal({ currentIndex: 'logs-2024' });

    // Initially logs-2024 should be selected
    const logsRow = screen.getByTestId('index-row-logs-2024');
    const logsRadio = logsRow.querySelector('input[type="radio"]');
    expect(logsRadio).toBeChecked();

    // Click on metrics-2024 row
    const metricsRow = screen.getByTestId('index-row-metrics-2024');
    await userEvent.click(metricsRow);

    // Now metrics-2024 should be selected
    const metricsRadio = metricsRow.querySelector('input[type="radio"]');
    expect(metricsRadio).toBeChecked();
    expect(logsRadio).not.toBeChecked();
  });

  it('calls onSelect and onClose when "Select index" button is clicked', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    renderModal({ onSelect, onClose, currentIndex: 'logs-2024' });

    // Change selection to metrics-2024
    const metricsRow = screen.getByTestId('index-row-metrics-2024');
    await userEvent.click(metricsRow);

    // Click Select index button
    await userEvent.click(screen.getByTestId('modal-select'));

    expect(onSelect).toHaveBeenCalledWith('metrics-2024');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose but NOT onSelect when "Cancel" is clicked', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    renderModal({ onSelect, onClose });

    await userEvent.click(screen.getByTestId('modal-cancel'));

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows "1 index selected" counter when an index is selected', async () => {
    renderModal({ currentIndex: 'logs-2024' });

    expect(screen.getByText('1 index selected')).toBeInTheDocument();
  });

  it('shows "0 indices selected" counter when nothing is selected', () => {
    renderModal({ currentIndex: '' });

    expect(screen.getByText('0 indices selected')).toBeInTheDocument();
  });
});
