import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExpandableRow from '../../../src/components/admin/ExpandableRow';

function renderRow() {
  return render(
    <table>
      <tbody>
        <ExpandableRow
          summary={<td>Summary cell</td>}
          detail={<div>Detail content</div>}
          colSpan={2}
        />
      </tbody>
    </table>
  );
}

describe('ExpandableRow', () => {
  test('starts collapsed — detail content is not shown', () => {
    renderRow();
    expect(screen.getByText('Summary cell')).toBeInTheDocument();
    expect(screen.queryByText('Detail content')).not.toBeInTheDocument();
    expect(screen.getByText('▸')).toBeInTheDocument();
  });

  test('clicking the summary row expands to show the detail content', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('Summary cell'));

    expect(screen.getByText('Detail content')).toBeInTheDocument();
    expect(screen.getByText('▾')).toBeInTheDocument();
  });

  test('clicking again collapses it', async () => {
    const user = userEvent.setup();
    renderRow();

    await user.click(screen.getByText('Summary cell'));
    expect(screen.getByText('Detail content')).toBeInTheDocument();

    await user.click(screen.getByText('Summary cell'));
    expect(screen.queryByText('Detail content')).not.toBeInTheDocument();
  });
});
