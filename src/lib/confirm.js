import Swal from 'sweetalert2';

/**
 * Shows a SweetAlert2 confirmation dialog, styled to match the app.
 * Resolves to true if the user confirmed, false otherwise.
 */
export function confirmAction({
  title,
  text,
  confirmButtonText = 'Yes, continue',
  cancelButtonText = 'Cancel',
  danger = false,
  icon = 'warning',
}) {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: danger ? '#b3392c' : '#2a5c37',
    cancelButtonColor: '#5b6b5c',
    reverseButtons: true,
    focusCancel: !danger,
    customClass: { popup: 'swal-popup' },
  }).then((result) => result.isConfirmed);
}

/**
 * Same as confirmAction, but with a <select> baked into the dialog so a
 * value can be picked as part of confirming (e.g. "which delivery location")
 * instead of needing a separate control on the page. Resolves to the chosen
 * value, or null if cancelled/dismissed.
 */
export function confirmWithSelect({
  title,
  text,
  options, // [{ value, label }]
  defaultValue,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
}) {
  return Swal.fire({
    title,
    text,
    input: 'select',
    inputOptions: Object.fromEntries(options.map((o) => [o.value, o.label])),
    inputValue: defaultValue,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: '#2a5c37',
    cancelButtonColor: '#5b6b5c',
    reverseButtons: true,
    customClass: { popup: 'swal-popup' },
  }).then((result) => (result.isConfirmed ? result.value : null));
}

/** One-button error dialog, styled to match the app's confirm dialogs. */
export function alertError(title, text) {
  return Swal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonColor: '#2a5c37',
    customClass: { popup: 'swal-popup' },
  });
}

export function confirmDelete(subject) {
  return confirmAction({
    title: `Delete ${subject}?`,
    text: "This can't be undone.",
    confirmButtonText: 'Delete',
    danger: true,
    icon: 'warning',
  });
}
