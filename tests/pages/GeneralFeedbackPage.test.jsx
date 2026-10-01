import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GeneralFeedbackPage from '../../src/pages/GeneralFeedbackPage';
import { api, ApiError } from '../../src/lib/api';
import { getRecaptchaToken } from '../../src/lib/recaptcha';

vi.mock('../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { api: { submitGeneralFeedback: vi.fn() }, ApiError };
});

vi.mock('../../src/lib/recaptcha', () => ({ getRecaptchaToken: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter>
      <GeneralFeedbackPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecaptchaToken.mockResolvedValue('recaptcha-token');
});

describe('GeneralFeedbackPage', () => {
  test('blocks submit and shows an error when no star rating is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByText('Pick a star rating first.')).toBeInTheDocument();
    expect(api.submitGeneralFeedback).not.toHaveBeenCalled();
  });

  test('selecting a star rating and submitting calls the API and shows the thank-you state', async () => {
    api.submitGeneralFeedback.mockResolvedValue({ id: 'fb1' });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '4 stars' }));
    await user.type(screen.getByLabelText('Comment (optional)'), 'Loved the efo riro');
    await user.type(screen.getByLabelText('Your name (optional)'), 'Ada');
    await user.type(screen.getByLabelText('Your area (optional)'), 'Bodija, Ibadan');
    await user.type(screen.getByLabelText('What did you have? (optional)'), 'Efo riro with rice');
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByRole('heading', { name: 'Thanks for your feedback!' })).toBeInTheDocument();
    expect(api.submitGeneralFeedback).toHaveBeenCalledWith({
      rating: 4,
      comment: 'Loved the efo riro',
      customerName: 'Ada',
      location: 'Bodija, Ibadan',
      foodType: 'Efo riro with rice',
      recaptchaToken: 'recaptcha-token',
    });
  });

  test('submits with undefined optional fields when left blank', async () => {
    api.submitGeneralFeedback.mockResolvedValue({ id: 'fb1' });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '5 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    await screen.findByRole('heading', { name: 'Thanks for your feedback!' });
    expect(api.submitGeneralFeedback).toHaveBeenCalledWith({
      rating: 5,
      comment: undefined,
      customerName: undefined,
      location: undefined,
      foodType: undefined,
      recaptchaToken: 'recaptcha-token',
    });
  });

  test('an API error shows the server message and keeps the form visible', async () => {
    api.submitGeneralFeedback.mockRejectedValue(new ApiError('Could not reach server', 500));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '3 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByText('Could not reach server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeInTheDocument();
  });

  test('a generic error shows the fallback message', async () => {
    api.submitGeneralFeedback.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '3 stars' }));
    await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

    expect(await screen.findByText('Could not submit your feedback. Please try again.')).toBeInTheDocument();
  });
});
