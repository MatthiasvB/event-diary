// All UI strings. To translate, provide another object of the same shape.

export const locale = 'de-DE';

export const t = {
	nav: {
		plants: 'Pflanzen',
		events: 'Ereignisse',
		add: 'Erfassen',
		photo: 'Foto',
		more: 'Mehr'
	},
	common: {
		save: 'Speichern',
		cancel: 'Abbrechen',
		delete: 'Löschen',
		edit: 'Bearbeiten',
		repeat: 'Wiederholen',
		back: 'Zurück',
		all: 'Alle',
		none: 'Keine',
		yes: 'Ja',
		no: 'Nein',
		search: 'Suchen',
		filter: 'Filter',
		reset: 'Zurücksetzen',
		add: 'Hinzufügen',
		remove: 'Entfernen',
		apply: 'Übernehmen',
		confirmDelete: 'Wirklich löschen? Das kann nicht rückgängig gemacht werden.'
	},
	combobox: {
		create: (v: string) => `+ Neu: „${v}“`,
		similar: 'Gibt es schon ähnlich:',
		use: (v: string) => `„${v}“ verwenden`
	},
	date: {
		today: 'Heute',
		yesterday: 'Gestern',
		daysAgo: (n: number) => `vor ${n} Tagen`,
		inDays: (n: number) => `in ${n} Tagen`,
		placeholder: 'JJJJ-MM-TT',
		openCalendar: 'Kalender öffnen',
		clear: 'Datum leeren',
		invalid: 'Bitte ein gültiges Datum als JJJJ-MM-TT eingeben.'
	},
	login: {
		title: 'Anmelden',
		username: 'Benutzername',
		password: 'Passwort',
		submit: 'Anmelden',
		failed: 'Benutzername oder Passwort falsch.',
		throttled: 'Zu viele Fehlversuche. Bitte später erneut versuchen.',
		logout: 'Abmelden',
		loggedInAs: (u: string) => `Angemeldet als ${u}`
	},
	plants: {
		title: 'Pflanzen',
		new: 'Neue Pflanze',
		edit: 'Pflanze bearbeiten',
		id: 'ID',
		name: 'Name',
		active: 'Aktiv',
		inactive: 'Inaktiv',
		activeFilter: { active: 'Aktive', inactive: 'Inaktive', all: 'Alle' },
		acquiredOn: 'Erworben am',
		notes: 'Notizen',
		attributes: 'Eigenschaften',
		attributesHint:
			'Änderungen hier korrigieren den aktuellen Wert. Für Änderungen mit Datum (z. B. Umzug) ein Ereignis erfassen.',
		addAttribute: 'Eigenschaft hinzufügen',
		history: 'Verlauf',
		since: 'seit',
		initial: 'von Anfang an',
		beforeNotRecorded: 'davor: nicht erfasst',
		notRecorded: 'nicht erfasst',
		editInitial: 'ändern',
		addInitial: 'eintragen',
		initialValue: 'Wert vor der ersten Änderung',
		confirmNotRecorded: (key: string, value: string) =>
			`„${value}“ als Anfangswert von „${key}“ entfernen? Der Wert vor der ersten Änderung gilt dann als nicht erfasst.`,
		events: (n: number) => (n === 1 ? '1 Ereignis' : `${n} Ereignisse`),
		lastEvent: 'Letztes Ereignis',
		noEvents: 'Noch keine Ereignisse.',
		empty: 'Keine Pflanzen gefunden.',
		searchPlaceholder: 'Name, ID oder Eigenschaft',
		addFilter: 'Nach Eigenschaft filtern',
		idTaken: 'Diese ID ist bereits vergeben.',
		idInvalid: 'Nur Buchstaben, Ziffern, Punkt, Binde- und Unterstrich.',
		nameRequired: 'Bitte einen Namen angeben.',
		cover: 'Als Titelbild',
		saveAndNext: 'Speichern & weitere',
		created: (name: string, id: string) => `„${name}“ (${id}) angelegt.`,
		view: 'Ansehen',
		photoHint: 'Das Foto wird als Ereignis gespeichert und als Titelbild verwendet.',
		isCover: 'Titelbild',
		deleteOnlyEmpty:
			'Nur Pflanzen ohne Ereignisse können gelöscht werden. Andere bitte auf inaktiv setzen.',
		timeline: 'Chronik',
		addEvent: 'Ereignis erfassen',
		takePhoto: 'Foto aufnehmen',
		photos: 'Fotos',
		key: 'Eigenschaft',
		value: 'Wert'
	},
	events: {
		title: 'Ereignisse',
		new: 'Ereignis erfassen',
		edit: 'Ereignis bearbeiten',
		plants: 'Pflanze(n)',
		choosePlants: 'Pflanzen wählen',
		selectedPlants: (n: number) => (n === 1 ? '1 Pflanze' : `${n} Pflanzen`),
		selectAllMatching: (n: number) => `Alle ${n} auswählen`,
		clearSelection: 'Auswahl leeren',
		onlyActive: 'nur aktive',
		date: 'Datum',
		type: 'Ereignis',
		category: 'Kategorie',
		milestone: 'Meilenstein',
		note: 'Notiz',
		fields: 'Angaben',
		addField: 'Angabe hinzufügen',
		fieldKey: 'Angabe',
		fieldValue: 'Wert',
		targetPlant: 'ändert Pflanze',
		targetPlantHint: 'Wird als Eigenschaft der Pflanze ab diesem Datum gespeichert.',
		previous: 'Wert davor:',
		previousKeep: 'unverändert',
		previousValue: 'eintragen …',
		previousPlaceholder: 'Wert vor dieser Änderung',
		previousHint:
			'Setzt den Anfangswert der Pflanze, falls es vor diesem Datum keine erfasste Änderung gibt.',
		currently: (v: string) => `aktuell: ${v}`,
		photos: 'Fotos',
		camera: 'Kamera',
		gallery: 'Galerie',
		exifDate: (d: string) => `Aufnahmedatum übernehmen: ${d}`,
		newType: 'Neuer Ereignistyp',
		applyToBatch: (n: number) =>
			`Änderungen auf alle ${n} Ereignisse dieser Sammelbuchung anwenden`,
		batch: (n: number) => `Sammelbuchung (${n})`,
		removePhoto: 'Foto entfernen',
		noPlants: 'Bitte mindestens eine Pflanze wählen.',
		noType: 'Bitte ein Ereignis angeben.',
		badDate: 'Bitte ein gültiges Datum angeben.',
		saved: (n: number) => (n === 1 ? 'Ereignis gespeichert.' : `${n} Ereignisse gespeichert.`),
		empty: 'Keine Ereignisse gefunden.',
		from: 'von',
		to: 'bis',
		allPlants: 'Alle Pflanzen',
		allTypes: 'Alle Ereignisse',
		allCategories: 'Alle Kategorien',
		more: 'Mehr anzeigen',
		/** Event type used when only a photo is recorded. */
		photoType: 'Foto dokumentiert',
		photoTypeCategory: 'Sonstiges'
	},
	types: {
		title: 'Ereignistypen',
		edit: 'Ereignistyp bearbeiten',
		name: 'Name',
		hint: 'Hinweis bei der Erfassung',
		fields: 'Übliche Angaben',
		fieldsHint:
			'Werden bei der Erfassung vorgeschlagen. Ohne Vorgabewert wird der Wert der letzten Verwendung vorgeschlagen.',
		default: 'Vorgabe',
		count: (n: number) => `${n}×`,
		unused: 'unbenutzt',
		renameHint: 'Umbenennen und Zusammenführen unter „Daten pflegen“.',
		deleteUsed:
			'Ereignistypen mit Ereignissen können nicht gelöscht werden. Zum Zusammenführen „Daten pflegen“ nutzen.',
		noCategory: 'Ohne Kategorie'
	},
	maintenance: {
		title: 'Daten pflegen',
		intro:
			'Werte umbenennen oder zusammenführen. Wird ein bestehender Wert als neuer Name gewählt, werden beide zusammengeführt und alle Einträge angepasst.',
		kinds: {
			category: 'Kategorien',
			type: 'Ereignistypen',
			key: 'Namen von Angaben/Eigenschaften',
			value: 'Werte'
		},
		chooseKey: 'Angabe/Eigenschaft',
		duplicates: 'Mögliche Doppelungen',
		noDuplicates: 'Keine ähnlichen Werte gefunden.',
		merge: 'Zusammenführen',
		mergeInto: (from: string, to: string) => `„${from}“ in „${to}“ zusammenführen`,
		renameTo: 'Neuer Name',
		uses: (n: number) => `${n}×`,
		done: (n: number) => `${n} Einträge angepasst.`,
		willMerge: (to: string) => `„${to}“ existiert bereits – die Werte werden zusammengeführt.`
	},
	photos: {
		dropHint: 'oder Fotos hierher ziehen'
	},
	gallery: {
		showAll: (n: number) => `Alle ${n} Fotos anzeigen`,
		previous: 'Vorheriges Foto',
		next: 'Nächstes Foto',
		original: 'Original',
		close: 'Schließen'
	},
	settings: {
		title: 'Einstellungen',
		overview: 'Spalten der Übersicht',
		overviewHint: 'Für jede Spalte wird das letzte Datum der gewählten Ereignistypen angezeigt.',
		label: 'Bezeichnung',
		types: 'Ereignistypen',
		addColumn: 'Spalte hinzufügen',
		up: 'Nach oben',
		down: 'Nach unten',
		saved: 'Gespeichert.'
	},
	more: {
		title: 'Mehr'
	},
	shortcuts: {
		title: 'Tastenkürzel',
		hint: 'Am Computer; auf dem Mac mit ⌘ statt Strg.',
		modifier: 'Strg',
		home: 'Pflanzenübersicht',
		newPlant: 'Neue Pflanze',
		newEvent: 'Ereignis erfassen (auf einer Pflanzenseite für diese Pflanze)',
		search: 'Pflanzen durchsuchen',
		save: 'Formular speichern'
	},
	errors: {
		notFound: 'Nicht gefunden.',
		generic: 'Etwas ist schiefgelaufen.'
	},
	/** Default overview columns, matched by name against existing event types. */
	defaultOverviewColumns: [
		{ label: 'Gedüngt', types: ['Düngen', 'Langzeitdünger'] },
		{ label: 'Umgetopft', types: ['Umtopfen'] },
		{ label: 'Neutrieb', types: ['Neutrieb sichtbar'] },
		{ label: 'Neue Wurzel', types: ['Neue Wurzel sichtbar'] },
		{ label: 'Blütentrieb', types: ['Blütentrieb sichtbar'] },
		{ label: 'Blühstart', types: ['Erste Blüte offen'] },
		{ label: 'Blütenende', types: ['Letzte Blüte abgefallen'] }
	]
};
