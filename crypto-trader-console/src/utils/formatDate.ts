export function formatDate(
  isoString: string | null | undefined,
  timeZone: string = 'Europe/Kiev',
): string {
  // Handle null, undefined, or empty string
  if (!isoString) {
    return 'N/A';
  }

  const date = new Date(isoString);

  // Check if the date is invalid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return formatter.format(date).replace(',', '');
}
