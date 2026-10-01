import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicHero from '../../src/components/PublicHero';

function renderHero() {
  return render(
    <MemoryRouter>
      <PublicHero />
    </MemoryRouter>
  );
}

describe('PublicHero', () => {
  test('renders the brand name', () => {
    renderHero();
    expect(screen.getByText(/dánọ́fúnmi/)).toBeInTheDocument();
  });

  test('brand link points home', () => {
    renderHero();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
  });
});
