import { resolve } from '$app/paths';
import { page } from '$app/state';
import { formatCrop, type Crop } from './domain/crop.ts';
import { t } from './i18n.ts';
import { diaryId } from './paths.ts';

export type Upload = { file: File; crop: Crop | null };

export const uncropped = (file: File): Upload => ({ file, crop: null });

export function pickedFiles(e: Event): File[] {
	const input = e.currentTarget as HTMLInputElement;
	const files = [...(input.files ?? [])];
	input.value = '';
	return files;
}

// A file is uploaded once, even if saving the form fails and is tried again.
const uploaded = new WeakMap<File, string>();

/** Throws errors whose message is meant for the user. */
export async function uploadFiles(
	uploads: Upload[],
	progress: (done: number) => void = () => {}
): Promise<string[]> {
	const max = page.data.maxUploadBytes;
	const tooLarge = uploads.find(({ file }) => max && file.size > max && !uploaded.has(file));
	if (tooLarge) throw new Error(t.files.tooLarge(tooLarge.file.name, max));

	const ids: string[] = [];
	for (const { file, crop } of uploads) {
		let id = uploaded.get(file);
		if (!id) {
			const res = await fetch(resolve('/[diary]/files', { diary: diaryId() }), {
				method: 'POST',
				body: file,
				headers: {
					'content-type': file.type || 'application/octet-stream',
					'x-file-name': encodeURIComponent(file.name),
					...(crop && { 'x-crop': formatCrop(crop) })
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
