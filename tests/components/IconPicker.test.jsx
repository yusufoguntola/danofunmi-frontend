import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconPicker from '../../src/components/IconPicker';
import { AdminAuthProvider } from '../../src/context/AdminAuthContext';
import { api, ApiError } from '../../src/lib/api';
import { fakeJwt } from '../helpers/fakeJwt';

vi.mock('../../src/lib/api', () => {
  class ApiError extends Error {
    constructor(message, status, body) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return {
    api: {
      BASE_URL: 'http://localhost:4000',
      adminUploadMenuIcon: vi.fn(),
      adminGenerateMenuIcon: vi.fn(),
    },
    ApiError,
  };
});

const STORAGE_KEY = 'danofunmi_admin_session';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  const token = fakeJwt({ type: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, admin: { email: 'admin@test.com' } }));
});

function renderPicker(props = {}) {
  const onChange = props.onChange || vi.fn();
  const utils = render(
    <AdminAuthProvider>
      <IconPicker value="" name="Jollof Rice" description="Spicy rice" {...props} onChange={onChange} />
    </AdminAuthProvider>
  );
  return { onChange, ...utils };
}

describe('IconPicker', () => {
  test('shows a default pot emoji placeholder when no value is set', () => {
    renderPicker();
    expect(screen.getByText('🍲')).toBeInTheDocument();
  });

  test('shows the raw emoji value in the preview and the emoji input', () => {
    renderPicker({ value: '🍗' });
    expect(screen.getAllByText('🍗').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Emoji')).toHaveValue('🍗');
  });

  test('renders an <img> preview for an uploaded icon path, prefixed with the API base URL', () => {
    const { container } = renderPicker({ value: '/uploads/icon.png' });
    const img = container.querySelector('.icon-picker__preview img');
    expect(img).toHaveAttribute('src', 'http://localhost:4000/uploads/icon.png');
  });

  test('renders an <img> preview using an absolute URL value as-is', () => {
    const { container } = renderPicker({ value: 'https://cdn.example.com/icon.png' });
    const img = container.querySelector('.icon-picker__preview img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/icon.png');
  });

  test('typing into the emoji input calls onChange directly with the typed text', () => {
    // fireEvent.change (not userEvent.type) — userEvent types astral emoji
    // char-by-UTF-16-code-unit, which mangles a surrogate pair mid-type;
    // this component is also uncontrolled between keystrokes in this test
    // (no state wrapper), so a single change event is the faithful way to
    // assert the onChange(e.target.value) wiring itself.
    const { onChange } = renderPicker({ value: '' });

    fireEvent.change(screen.getByPlaceholderText('Emoji'), { target: { value: '🍚' } });

    expect(onChange).toHaveBeenCalledWith('🍚');
  });

  test('uploading a file calls api.adminUploadMenuIcon with the token and file, and onChange with the result', async () => {
    api.adminUploadMenuIcon.mockResolvedValue({ path: '/uploads/new-icon.png' });
    const { container, onChange } = renderPicker();
    const file = new File(['data'], 'icon.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]');

    const user = userEvent.setup();
    await user.upload(fileInput, file);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/uploads/new-icon.png'));
    expect(api.adminUploadMenuIcon).toHaveBeenCalledWith(expect.any(String), file);
  });

  test('a failed upload (ApiError) shows the error message instead of calling onChange', async () => {
    api.adminUploadMenuIcon.mockRejectedValue(new ApiError('File too large', 413));
    const { container, onChange } = renderPicker();
    const file = new File(['data'], 'icon.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]');

    const user = userEvent.setup();
    await user.upload(fileInput, file);

    expect(await screen.findByText('File too large')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a failed upload with a non-ApiError shows a generic fallback message', async () => {
    api.adminUploadMenuIcon.mockRejectedValue(new Error('network blip'));
    const { container } = renderPicker();
    const file = new File(['data'], 'icon.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]');

    const user = userEvent.setup();
    await user.upload(fileInput, file);

    expect(await screen.findByText('Could not upload image.')).toBeInTheDocument();
  });

  test('clicking "Generate with AI" calls api.adminGenerateMenuIcon with the name/description and applies the result', async () => {
    api.adminGenerateMenuIcon.mockResolvedValue({ path: '/uploads/generated.png' });
    const user = userEvent.setup();
    const { onChange } = renderPicker({ name: 'Jollof Rice', description: 'Spicy rice' });

    await user.click(screen.getByRole('button', { name: /generate with ai/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/uploads/generated.png'));
    expect(api.adminGenerateMenuIcon).toHaveBeenCalledWith(expect.any(String), {
      name: 'Jollof Rice',
      description: 'Spicy rice',
    });
  });

  test('shows a "Working…" label on the Generate button while the request is in flight', async () => {
    let resolveGenerate;
    api.adminGenerateMenuIcon.mockReturnValue(new Promise((resolve) => { resolveGenerate = resolve; }));
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: /generate with ai/i }));
    expect(screen.getByRole('button', { name: 'Working…' })).toBeInTheDocument();

    resolveGenerate({ path: '/uploads/generated.png' });
    await waitFor(() => expect(screen.queryByText('Working…')).not.toBeInTheDocument());
  });

  test('clicking Generate without a name shows a validation error and does not call the API', async () => {
    const user = userEvent.setup();
    renderPicker({ name: '' });

    await user.click(screen.getByRole('button', { name: /generate with ai/i }));

    expect(await screen.findByText('Type the item name first so we know what image to find.')).toBeInTheDocument();
    expect(api.adminGenerateMenuIcon).not.toHaveBeenCalled();
  });

  test('a failed generate (ApiError) shows the error message', async () => {
    api.adminGenerateMenuIcon.mockRejectedValue(new ApiError('Out of credit', 402));
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: /generate with ai/i }));

    expect(await screen.findByText('Out of credit')).toBeInTheDocument();
  });
});
