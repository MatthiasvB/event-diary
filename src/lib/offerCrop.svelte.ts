import type { Crop } from './domain/crop.ts';
import type { Upload } from './upload.ts';

export type CropRequest = {
	url: string;
	width: number;
	height: number;
	done: (crop: Crop | null) => void;
};

export const cropping: { request: CropRequest | null } = $state({ request: null });

/** A photo the browser can't show, like HEIC outside Safari, stays whole. */
export async function offerCrop(file: File): Promise<Upload> {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = url;
		// The import defines the <cropper-…> elements the dialog is made of.
		await Promise.all([image.decode(), import('cropperjs')]);
		const crop = await new Promise<Crop | null>((done) => {
			cropping.request = { url, width: image.naturalWidth, height: image.naturalHeight, done };
		});
		return { file, crop };
	} catch {
		return { file, crop: null };
	} finally {
		cropping.request = null;
		URL.revokeObjectURL(url);
	}
}
