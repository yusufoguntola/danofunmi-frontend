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

export function confirmDelete(subject) {
  return confirmAction({
    title: `Delete ${subject}?`,
    text: "This can't be undone.",
    confirmButtonText: 'Delete',
    danger: true,
    icon: 'warning',
  });
}
