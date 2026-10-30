import type { Diary } from './harness.ts';

const PHAL = 'Phalaenopsis weiß';

export function buildScenario(d: Diary) {
	d.file('phal-1.jpg');
	d.object(
		PHAL,
		{
			properties: {
				Standort: 'Ostfenster',
				Substrat: 'Rinde',
				'Erworben am': '2025-04-12',
				Topfgröße: '12'
			},
			kinds: {
				'Erworben am': { kind: 'date', unit: '' },
				Topfgröße: { kind: 'number', unit: 'cm' }
			}
		},
		{ files: ['phal-1.jpg'], date: '2025-04-12' }
	);
	d.object('Cattleya', { properties: { Standort: 'Südfenster' } });
	d.object('Dendrobium', { properties: { Standort: 'Küche' }, active: false, notes: 'Geschenk' });
	d.object('Haus');

	const fertilize = {
		type: 'Düngen',
		category: 'Pflege',
		date: '2026-03-01',
		kinds: { Menge: { kind: 'number', unit: 'ml' } as const }
	};
	d.record({
		...fertilize,
		objects: [PHAL, 'Cattleya', 'Dendrobium'],
		note: 'halbe Dosis',
		details: { Produkt: 'Orchideendünger', Menge: '2,5' }
	});
	d.file('umtopfen.jpg');
	d.file('rechnung.pdf', 'application/pdf');
	d.record({
		objects: [PHAL],
		type: 'Umtopfen',
		category: 'Pflege',
		date: '2026-03-15',
		changes: { Substrat: 'Bims', Topfgröße: '14' },
		files: ['umtopfen.jpg', 'rechnung.pdf']
	});
	d.record({
		objects: ['Cattleya'],
		type: 'Umtopfen',
		category: 'Pflege',
		date: '2026-02-01',
		changes: { Substrat: { value: 'Rinde', before: 'Moos' } }
	});
	d.record({
		objects: ['Cattleya'],
		type: 'Standortwechsel',
		category: 'Pflege',
		date: '2026-04-01',
		changes: { Standort: 'Fensterbank' }
	});
	for (const date of ['2026-01-10', '2026-02-10']) {
		d.record({
			objects: ['Dendrobium'],
			type: 'Gießen',
			category: 'Pflege',
			date,
			details: { Wasser: 'Regenwasser' }
		});
	}
	d.record({
		objects: ['Haus'],
		type: 'Kontrolle',
		category: 'Haus',
		date: '2026-05-02',
		note: 'Kellerdecke trocken'
	});
	d.record({
		objects: ['Cattleya'],
		type: 'Kontrolle',
		category: 'Pflege',
		date: '2026-05-03',
		details: { Schädlinge: 'keine' }
	});
	d.file('bluete.jpg');
	d.file('bluete.mp4', 'video/mp4');
	const bloom = {
		objects: [PHAL],
		type: 'Blüte',
		milestone: true,
		date: '2026-05-20',
		files: ['bluete.jpg', 'bluete.mp4']
	};
	d.record({ ...bloom, note: 'Erste Rispe' });
	d.record({
		objects: [PHAL],
		type: 'Düngen',
		category: 'Pflege',
		date: '2026-04-01',
		details: { Produkt: 'Orchideendunger', Mänge: '2' }
	});
	d.record({
		objects: ['Cattleya'],
		type: 'Dügen',
		category: 'Pflege',
		date: '2026-04-15',
		details: { Produkt: 'Orchideendünger' }
	});
	const moved = d.record({
		objects: ['Dendrobium'],
		type: 'Standortwechsel',
		category: 'Pflege',
		date: '2026-06-01',
		changes: { Standort: 'Bad' }
	});

	d.columns({ Gedüngt: ['Pflege/Düngen', 'Pflege/Dügen'], Umgetopft: ['Pflege/Umtopfen'] });
	d.order(['Standort', 'Substrat']);

	d.rename({ kind: 'type' }, 'Dügen', 'Düngen');
	d.rename({ kind: 'value', key: 'Produkt' }, 'Orchideendunger', 'Orchideendünger');
	d.rename({ kind: 'key' }, 'Mänge', 'Menge');

	d.edit(d.event(PHAL, '2026-03-01', 'Pflege/Düngen'), {
		...fertilize,
		objects: [PHAL],
		note: 'volle Dosis',
		details: { Produkt: 'Orchideendünger', Menge: '2.5' },
		applyToBatch: true
	});
	d.edit(d.event(PHAL, '2026-05-20', 'Blüte'), { ...bloom, note: 'Erste Rispe, 8 Knospen' });
	d.deleteEvent(moved);

	d.editObject('Dendrobium', {
		properties: { Standort: 'Küche', Wasser: 'Leitungswasser' },
		active: false,
		notes: 'Geschenk'
	});
	d.editObject(PHAL, {
		properties: {
			Standort: 'Ostfenster',
			Substrat: 'Bims',
			'Erworben am': '2025-04-10',
			Topfgröße: '14'
		}
	});
	d.editObject('Cattleya', { properties: { Standort: 'Wohnzimmer', Substrat: 'Rinde' } });
	d.setInitial('Cattleya', 'Substrat', 'Sphagnum');
	d.forgetInitial(PHAL, 'Topfgröße');

	d.saveType('Pflege/Umtopfen', {
		category: 'Pflege',
		hint: 'Nach der Blüte',
		fields: [
			{ key: 'Substrat', target: 'object' },
			{ key: 'Topfgröße', target: 'object', default: '14' }
		]
	});
	d.cover(PHAL, 'bluete.jpg');
}
