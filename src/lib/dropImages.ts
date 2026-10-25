import type { Attachment } from 'svelte/attachments';

export function isImage(file: File) {
	return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
}

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

/**
 * Accepts image files dropped onto the element (desktop drag and drop). While files are
 * dragged over it, the element has the class "dropping".
 */
export function dropImages(ondrop: (files: File[]) => void): Attachment<HTMLElement> {
	return (node) => {
		let depth = 0; // dragenter/dragleave also fire for child elements
		const reset = () => {
			depth = 0;
			node.classList.remove('dropping');
		};
		const enter = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			depth++;
			node.classList.add('dropping');
		};
		const over = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.dataTransfer!.dropEffect = 'copy';
		};
		const leave = (e: DragEvent) => {
			if (hasFiles(e) && --depth <= 0) reset();
		};
		const drop = (e: DragEvent) => {
			if (!hasFiles(e)) return;
			e.preventDefault();
			e.stopPropagation(); // the innermost drop zone wins
			reset();
			const files = [...e.dataTransfer!.files].filter(isImage);
			if (files.length) ondrop(files);
		};
		node.addEventListener('dragenter', enter);
		node.addEventListener('dragover', over);
		node.addEventListener('dragleave', leave);
		node.addEventListener('drop', drop);
		return () => {
			node.removeEventListener('dragenter', enter);
			node.removeEventListener('dragover', over);
			node.removeEventListener('dragleave', leave);
			node.removeEventListener('drop', drop);
		};
	};
}
