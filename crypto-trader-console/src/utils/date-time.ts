/**
 * Formats an ISO date string to a localized date-time string
 * @param isoString - ISO date string to format
 * @param timeZone - Target timezone (default: 'Europe/Kyiv')
 * @returns Formatted date string or 'N/A'/'Invalid Date' for invalid inputs
 */
export function formatDate(
  isoString: string | null | undefined,
  timeZone: string = 'Europe/Kyiv',
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

/**
 * Formats a Date object to YYYY-MM-DD string for date pickers
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format
 */
export const formatDateForPicker = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Converts a date string to ISO string representing start of day in specified timezone
 * @param dateString - Date string in YYYY-MM-DD format
 * @param timezone - Target timezone (default: 'Europe/Kyiv')
 * @returns ISO string representing start of day in the target timezone converted to UTC
 */
export const dateStringToTimezoneISO = (
  dateString: string,
  timezone: string = 'Europe/Kyiv',
): string => {
  // Parse the date string (YYYY-MM-DD format)
  const [year, month, day] = dateString.split('-').map(Number);

  // Simple and correct approach:
  // Create a date representing midnight in UTC for the given date
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Get the timezone offset for this specific date in the target timezone
  // We need to know how many hours the target timezone is ahead/behind UTC
  const tempDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid DST edge cases

  // Format the same moment in time in both UTC and target timezone
  const utcString = tempDate.toLocaleString('sv-SE', { timeZone: 'UTC' });
  const targetString = tempDate.toLocaleString('sv-SE', { timeZone: timezone });

  // Calculate the offset in milliseconds
  const utcTime = new Date(utcString).getTime();
  const targetTime = new Date(targetString).getTime();
  const offsetMs = targetTime - utcTime;

  // Adjust the UTC midnight by the timezone offset
  // If timezone is UTC+3, we want to subtract 3 hours from UTC midnight
  // to get the UTC time that represents midnight in that timezone
  const adjustedDate = new Date(utcMidnight.getTime() - offsetMs);

  return adjustedDate.toISOString();
};
