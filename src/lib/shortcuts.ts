import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { t } from './i18n.ts';
import { canEdit, diaryId } from './paths.ts';

type Shortcut = { key: string; label: string; run: () => unknown; edits?: boolean };

function currentObject(): string | undefined {
	const route = page.route.id;
	return route === '/[diary]/objects/[id]' || route === '/[diary]/objects/[id]/edit'
		? page.params.id
		: undefined;
}

async function focusSearch() {
	if (page.route.id !== '/[diary]') await goto(resolve('/[diary]', { diary: diaryId() }));
	document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
}

function submitForm() {
	const focused = document.activeElement?.closest('form');
	(focused ?? document.querySelector<HTMLFormElement>('main form'))?.requestSubmit();
}

export const shortcuts: Shortcut[] = [
	{ key: 'h', label: t.shortcuts.home, run: () => goto(resolve('/[diary]', { diary: diaryId() })) },
	{
		key: 'p',
		label: t.shortcuts.newObject,
		edits: true,
		run: () => goto(resolve('/[diary]/objects/new', { diary: diaryId() }))
	},
	{
		key: 'e',
		label: t.shortcuts.newEvent,
		edits: true,
		run: () => {
			const object = currentObject();
			const diary = diaryId();
			return goto(
				object
					? resolve(`/[diary]/events/new?object=${encodeURIComponent(object)}`, { diary })
					: resolve('/[diary]/events/new', { diary })
			);
		}
	},
	{ key: 'k', label: t.shortcuts.search, run: focusSearch },
	{ key: 'Enter', label: t.shortcuts.save, run: submitForm, edits: true }
];

export function handleShortcut(e: KeyboardEvent) {
	if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.repeat || e.isComposing) return;
	if (!page.params.diary) return;
	const shortcut = shortcuts.find((s) => s.key.toLowerCase() === e.key.toLowerCase());
	if (!shortcut || (shortcut.edits && !canEdit())) return;
	e.preventDefault();
	shortcut.run();
}

export function shortcutLabel(key: string) {
	return `${t.shortcuts.modifier}+${key.length === 1 ? key.toUpperCase() : key}`;
}
