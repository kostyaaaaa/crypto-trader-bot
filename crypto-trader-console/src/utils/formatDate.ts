export function formatDate(
  isoString: string,
  timeZone: string = 'Europe/Kiev',
): string {
  const date = new Date(isoString);

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
