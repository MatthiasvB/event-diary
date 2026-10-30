import { resolve } from '$app/paths';
import { page } from '$app/state';
import { t } from './i18n.ts';
import { diaryId } from './paths.ts';

// A file is uploaded once, even if saving the form fails and is tried again.
const uploaded = new WeakMap<File, string>();

/** Throws errors whose message is meant for the user. */
export async function uploadFiles(
	files: File[],
	progress: (done: number) => void = () => {}
): Promise<string[]> {
	const max = page.data.maxUploadBytes;
	const tooLarge = files.find((f) => max && f.size > max && !uploaded.has(f));
	if (tooLarge) throw new Error(t.files.tooLarge(tooLarge.name, max));

	const ids: string[] = [];
	for (const file of files) {
		let id = uploaded.get(file);
		if (!id) {
			const res = await fetch(resolve('/[diary]/files', { diary: diaryId() }), {
				method: 'POST',
				body: file,
				headers: {
					'content-type': file.type || 'application/octet-stream',
					'x-file-name': encodeURIComponent(file.name)
				}
			}).catch(() => null);
			if (!res?.ok) {
				throw new Error(
					res?.status === 413 ? t.files.tooLarge(file.name) : t.files.uploadFailed(file.name)
				);
			}
			id = ((await res.json()) as { id: string }).id;
			uploaded.set(file, id);
		}
		ids.push(id);
		progress(ids.length);
	}
	return ids;
}
