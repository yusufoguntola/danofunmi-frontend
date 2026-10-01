import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../../../src/components/admin/Pagination';

function baseProps(overrides = {}) {
  return {
    page: 1,
    pageCount: 3,
    pageSize: 10,
    total: 25,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    ...overrides,
  };
}

describe('Pagination', () => {
  test('renders nothing when total is 0', () => {
    const { container } = render(<Pagination {...baseProps({ total: 0, pageCount: 1 })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows the current range and page', () => {
    render(<Pagination {...baseProps({ page: 2, pageSize: 10, total: 25 })} />);
    expect(screen.getByText(/11.*25/)).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  test('Prev is disabled on the first page', () => {
    render(<Pagination {...baseProps({ page: 1 })} />);
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  test('Next is disabled on the last page', () => {
    render(<Pagination {...baseProps({ page: 3, pageCount: 3 })} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
  });

  test('clicking Next calls onPageChange with page + 1', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...baseProps({ page: 1, onPageChange })} />);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test('clicking Prev calls onPageChange with page - 1', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination {...baseProps({ page: 2, onPageChange })} />);

    await user.click(screen.getByRole('button', { name: 'Prev' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  test('changing the page-size select calls onPageSizeChange with a number', async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(<Pagination {...baseProps({ onPageSizeChange })} />);

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  test('uses the default page size options when none are passed', () => {
    render(<Pagination {...baseProps()} />);
    const select = screen.getByLabelText('Rows per page');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['10', '25', '50', '100']);
  });

  test('respects a custom pageSizeOptions prop', () => {
    render(<Pagination {...baseProps({ pageSizeOptions: [5, 15] })} />);
    const select = screen.getByLabelText('Rows per page');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['5', '15']);
  });
});
