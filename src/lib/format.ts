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

export function isValidDate(s: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
