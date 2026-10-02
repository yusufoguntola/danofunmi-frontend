import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ScrollToTop from '../../src/components/ScrollToTop';

function PageA() {
  return (
    <div>
      Page A
      <Link to="/b">Go to B</Link>
    </div>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/a']}>
      <ScrollToTop />
      <Routes>
        <Route path="/a" element={<PageA />} />
        <Route path="/b" element={<div>Page B</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe('ScrollToTop', () => {
  test('scrolls to top on mount', () => {
    renderApp();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('scrolls to top again when the pathname changes within the same router', async () => {
    const user = userEvent.setup();
    renderApp();
    window.scrollTo.mockClear();

    await user.click(screen.getByText('Go to B'));

    expect(await screen.findByText('Page B')).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test('renders nothing itself', () => {
    renderApp();
    expect(screen.getByText('Page A')).toBeInTheDocument();
  });
});
