import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../src/components/Modal';

describe('Modal', () => {
  test('pressing Escape calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Body content</p>
      </Modal>
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  test('clicking the backdrop calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Body content</p>
      </Modal>
    );

    await user.click(container.querySelector('.modal__backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  test('clicking inside the panel does not call onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Body content</p>
      </Modal>
    );

    await user.click(screen.getByText('Body content'));

    expect(onClose).not.toHaveBeenCalled();
  });

  test('clicking the close (×) button calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal title="Test modal" onClose={onClose}>
        <p>Body content</p>
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  test('renders the title and children', () => {
    render(
      <Modal title="Test modal" onClose={() => {}}>
        <p>Body content</p>
      </Modal>
    );

    expect(screen.getByText('Test modal')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  test('applies an optional panelClassName to the panel', () => {
    const { container } = render(
      <Modal title="Test modal" onClose={() => {}} panelClassName="wide">
        <p>Body content</p>
      </Modal>
    );

    expect(container.querySelector('.modal__panel')).toHaveClass('wide');
  });
});
