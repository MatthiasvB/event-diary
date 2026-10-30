import { resolve } from '$app/paths';
import { page } from '$app/state';

export function diaryId(): string {
	return page.params.diary ?? '';
}

export function photoUrl(id: string, size: 's' | 'l' | 'original') {
	return resolve(`/[diary]/files/[id]?size=${size}`, { diary: diaryId(), id });
}

export function fileUrl(id: string, download = false) {
	const diary = diaryId();
	return download
		? resolve(`/[diary]/files/[id]?size=original&download=1`, { diary, id })
		: resolve(`/[diary]/files/[id]?size=original`, { diary, id });
}

export function canEdit(): boolean {
	return (page.data.diary as { role?: string } | undefined)?.role !== 'viewer';
}
