import './StarInput.css';

/** Interactive when `onChange` is given, read-only display otherwise. Shared
 * by FeedbackPage (order feedback) and GeneralFeedbackPage. */
export default function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-input__star${n <= value ? ' is-filled' : ''}`}
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={onChange ? n === value : undefined}
        >
          ★
        </button>
      ))}
    </div>
  );
}
