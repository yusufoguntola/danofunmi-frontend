import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import LogoMark from '../../src/components/LogoMark';

describe('LogoMark', () => {
  test('renders an svg without crashing, defaulting to size 24', () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  test('respects a custom size prop for both width and height', () => {
    const { container } = render(<LogoMark size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  test('applies an optional className', () => {
    const { container } = render(<LogoMark className="custom-class" />);
    expect(container.querySelector('svg')).toHaveClass('custom-class');
  });

  test('is hidden from assistive tech (aria-hidden)', () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
