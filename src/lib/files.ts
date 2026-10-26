// Event attachments: photos, videos and any other files (documents etc.).

export type FileKind = 'image' | 'video' | 'file';

export type EventFile = { id: string; mime: string; name: string };

export function fileKind(mime: string, name = ''): FileKind {
	if (mime.startsWith('image/') || /\.(heic|heif)$/i.test(name)) return 'image';
	if (mime.startsWith('video/')) return 'video';
	return 'file';
}

/** Photos and videos, shown as tiles; other files are listed by name. */
export function isMedia(file: { type: string; name: string }) {
	return fileKind(file.type, file.name) !== 'file';
}

/** Documents a browser shows by itself (opened in a new tab); others are only downloaded. */
export function canView(mime: string) {
	return mime === 'application/pdf' || mime === 'text/plain';
}
