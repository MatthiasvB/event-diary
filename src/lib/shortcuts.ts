// Desktop keyboard shortcuts: Ctrl (⌘ on macOS) + key. While the app has focus, they take
// precedence over the browser's own shortcuts for the same keys.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { t } from './i18n.ts';

type Shortcut = { key: string; label: string; run: () => unknown };

/** The plant whose page (or edit page) is open, if any. */
function currentPlant(): string | undefined {
	const route = page.route.id;
	return route === '/plants/[id]' || route === '/plants/[id]/edit' ? page.params.id : undefined;
}

async function focusSearch() {
	if (page.route.id !== '/') await goto(resolve('/'));
	document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
}

/** Saves the form that has focus, or else the page's main form. */
function submitForm() {
	const focused = document.activeElement?.closest('form');
	(focused ?? document.querySelector<HTMLFormElement>('main form'))?.requestSubmit();
}

export const shortcuts: Shortcut[] = [
	{ key: 'h', label: t.shortcuts.home, run: () => goto(resolve('/')) },
	{ key: 'p', label: t.shortcuts.newPlant, run: () => goto(resolve('/plants/new')) },
	{
		key: 'e',
		label: t.shortcuts.newEvent,
		run: () => {
			const plant = currentPlant();
			return goto(
				plant ? resolve(`/events/new?plant=${encodeURIComponent(plant)}`) : resolve('/events/new')
			);
		}
	},
	{ key: 'k', label: t.shortcuts.search, run: focusSearch },
	{ key: 'Enter', label: t.shortcuts.save, run: submitForm }
];

export function handleShortcut(e: KeyboardEvent) {
	if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.repeat || e.isComposing) return;
	if (page.route.id === '/login') return;
	const shortcut = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
	if (!shortcut) return;
	e.preventDefault();
	shortcut.run();
}

/** "Strg+H" for display. */
export function shortcutLabel(key: string) {
	return `${t.shortcuts.modifier}+${key.length === 1 ? key.toUpperCase() : key}`;
}
