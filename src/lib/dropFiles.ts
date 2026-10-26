import type { Attachment } from 'svelte/attachments';

const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

/**
 * Accepts files dropped onto the element (desktop drag and drop), optionally only some
 * (`accept`). While files are dragged over it, the element has the class "dropping".
 */
export function dropFiles(
	ondrop: (files: File[]) => void,
	accept: (file: File) => boolean = () => true
): Attachment<HTMLElement> {
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
			const files = [...e.dataTransfer!.files].filter(accept);
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
