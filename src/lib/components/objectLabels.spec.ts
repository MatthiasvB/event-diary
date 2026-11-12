import { expect, it } from 'vitest';
import { distinctLabels } from './objectLabels.ts';

it('numbers objects that share a name, in the order they were created', () => {
	expect([...distinctLabels({ 3: 'Regal', 1: 'Regal', 2: 'Auto', 7: 'Regal' })]).toEqual([
		[1, 'Regal'],
		[2, 'Auto'],
		[3, 'Regal (2)'],
		[7, 'Regal (3)']
	]);
});

it('skips a number another object has as its name', () => {
	expect([...distinctLabels({ 1: 'Regal', 2: 'Regal (2)', 3: 'Regal' })]).toEqual([
		[1, 'Regal'],
		[2, 'Regal (2)'],
		[3, 'Regal (3)']
	]);
});
