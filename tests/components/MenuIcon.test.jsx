import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MenuIcon from '../../src/components/MenuIcon';

vi.mock('../../src/lib/api', () => ({
  api: { BASE_URL: 'http://localhost:4000' },
}));

describe('MenuIcon', () => {
  test('renders an emoji/text icon as plain text, not an image', () => {
    const { container } = render(<MenuIcon icon="🍲" />);
    expect(screen.getByText('🍲')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  test('renders an /uploads/... path as an <img>, prefixed with the API base URL', () => {
    const { container } = render(<MenuIcon icon="/uploads/stew.png" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://localhost:4000/uploads/stew.png');
  });

  test('renders an http(s):// path as an <img> with the URL unchanged', () => {
    const { container } = render(<MenuIcon icon="https://example.com/stew.png" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://example.com/stew.png');
  });

  test('applies imgClassName to the image, falling back to className when absent', () => {
    const { container, rerender } = render(<MenuIcon icon="/uploads/stew.png" className="base" imgClassName="img-specific" />);
    expect(container.querySelector('img')).toHaveClass('img-specific');

    rerender(<MenuIcon icon="/uploads/stew.png" className="base" />);
    expect(container.querySelector('img')).toHaveClass('base');
  });

  test('applies className to the text span', () => {
    render(<MenuIcon icon="🍲" className="emoji-class" />);
    expect(screen.getByText('🍲')).toHaveClass('emoji-class');
  });
});
