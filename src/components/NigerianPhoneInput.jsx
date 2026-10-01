import { NG_COUNTRY_CODE, subscriberDigits, toNigerianPhone } from '../lib/phone';
import './NigerianPhoneInput.css';

/** A phone-number field for a Nigerian mobile number — the "+234" country
 * code is fixed, the customer only types the 10-digit subscriber number.
 * `value`/`onChange` work like a plain input's, except the value is always
 * the full "+234XXXXXXXXXX" string (or a partial digits-only string while
 * still typing) rather than just the digits — `onChange(nextFullPhone)`. */
export default function NigerianPhoneInput({ id, value, onChange, readOnly, required, placeholder }) {
  const digits = subscriberDigits(value);

  function handleChange(e) {
    onChange(toNigerianPhone(subscriberDigits(e.target.value)));
  }

  return (
    <div className={`ng-phone-input${readOnly ? ' ng-phone-input--readonly' : ''}`}>
      <span className="ng-phone-input__code">{NG_COUNTRY_CODE}</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={digits}
        onChange={handleChange}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder || '8012345678'}
        maxLength={10}
        pattern="[789][0-9]{9}"
        title="A 10-digit Nigerian mobile number, e.g. 8012345678"
      />
    </div>
  );
}
