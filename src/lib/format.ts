import { locale, t } from './i18n.ts';

/** Today's date in local time, YYYY-MM-DD. */
export function today(): string {
	return isoDate(new Date());
}

export function isoDate(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDays(date: string, days: number): string {
	const d = new Date(`${date}T12:00:00`);
	d.setDate(d.getDate() + days);
	return isoDate(d);
}

const dateFormat = new Intl.DateTimeFormat(locale, {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric'
});

/** "2026-09-13" → "13.09.2026" */
export function formatDate(date: string | null | undefined): string {
	if (!date) return '';
	return dateFormat.format(new Date(`${date.slice(0, 10)}T12:00:00`));
}

/** "heute", "gestern", "vor 12 Tagen" */
export function relativeDays(date: string, now = today()): string {
	const days = Math.round((Date.parse(now) - Date.parse(date.slice(0, 10))) / 86_400_000);
	if (days === 0) return t.date.today;
	if (days === 1) return t.date.yesterday;
	return days > 0 ? t.date.daysAgo(days) : t.date.inDays(-days);
}

/** A real calendar date in the form YYYY-MM-DD. */
export function isValidDate(s: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return false;
	const [y, mo, d] = m.slice(1).map(Number);
	const date = new Date(y, mo - 1, d);
	return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/**
 * Formats digits typed year first into YYYY-MM-DD while typing: "2026102" → "2026-10-2".
 * A month digit above 1 or a day digit above 3 can only be a single digit and is padded:
 * "20269" → "2026-09".
 */
export function formatTypedDate(input: string): string {
	let digits = input.replace(/\D/g, '');
	if (digits.length > 4 && digits[4] > '1') digits = `${digits.slice(0, 4)}0${digits.slice(4)}`;
	if (digits.length > 6 && digits[6] > '3') digits = `${digits.slice(0, 6)}0${digits.slice(6)}`;
	digits = digits.slice(0, 8);
	return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
}
