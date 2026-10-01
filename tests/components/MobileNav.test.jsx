import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileNav from '../../src/components/MobileNav';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileNav />
    </MemoryRouter>
  );
}

describe('MobileNav', () => {
  test('renders all four nav items with their correct hrefs', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: /Home/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Menu/ })).toHaveAttribute('href', '/menu');
    expect(screen.getByRole('link', { name: /Order/ })).toHaveAttribute('href', '/order');
    expect(screen.getByRole('link', { name: /My orders/ })).toHaveAttribute('href', '/orders');
  });

  test('marks the Home link active (via NavLink is-active) only on the exact root path', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: /Home/ })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: /Menu/ })).not.toHaveClass('is-active');
  });

  test('Home is not marked active on a different route, thanks to its `end` match', () => {
    renderAt('/menu');

    expect(screen.getByRole('link', { name: /Home/ })).not.toHaveClass('is-active');
    expect(screen.getByRole('link', { name: /Menu/ })).toHaveClass('is-active');
  });

  test('marks the Order link active when on /order', () => {
    renderAt('/order');

    expect(screen.getByRole('link', { name: /Order/ })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: /My orders/ })).not.toHaveClass('is-active');
  });

  test('marks the My orders link active when on /orders', () => {
    renderAt('/orders');

    expect(screen.getByRole('link', { name: /My orders/ })).toHaveClass('is-active');
    expect(screen.getByRole('link', { name: /Order/ })).not.toHaveClass('is-active');
  });

  test('every nav item still carries the base mobile-nav__item class whether active or not', () => {
    renderAt('/menu');

    expect(screen.getByRole('link', { name: /Home/ })).toHaveClass('mobile-nav__item');
    expect(screen.getByRole('link', { name: /Menu/ })).toHaveClass('mobile-nav__item');
  });
});
