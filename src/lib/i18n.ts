// All UI strings. To translate, provide another object of the same shape.

export const locale = 'de-DE';

const n = (count: number, one: string, many: string) =>
	count === 1 ? `1 ${one}` : `${count} ${many}`;

/** Confirmation for deletions that take events (and maybe photos) along. */
const confirmWithEvents = (what: string, impact: { events: number; files: number }) =>
	`${what} endgültig löschen?` +
	(impact.events
		? ` Dabei ${impact.events === 1 && !impact.files ? 'wird' : 'werden'} ${n(impact.events, 'Ereignis', 'Ereignisse')}` +
			(impact.files ? ` und ${n(impact.files, 'Datei', 'Dateien')}` : '') +
			' gelöscht.'
		: '') +
	' Das kann nicht rückgängig gemacht werden.';

export const t = {
	nav: {
		objects: 'Objekte',
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
		confirmDelete: 'Wirklich löschen? Das kann nicht rückgängig gemacht werden.',
		clear: 'Leeren'
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
	objects: {
		title: 'Objekte',
		new: 'Neues Objekt',
		edit: 'Objekt bearbeiten',
		name: 'Name',
		active: 'Aktiv',
		inactive: 'Inaktiv',
		activeFilter: { active: 'Aktive', inactive: 'Inaktive', all: 'Alle' },
		notes: 'Notizen',
		attributes: 'Eigenschaften',
		fromEvents: (key: string, count: number) =>
			`„${key}“ wurde bisher bei ${n(count, 'Ereignis', 'Ereignissen')} angegeben. Diese Werte werden zu Änderungen der Eigenschaft ihres Objekts.`,
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
		empty: 'Keine Objekte gefunden.',
		searchPlaceholder: 'Name oder Eigenschaft',
		addFilter: 'Nach Eigenschaft filtern',
		nameRequired: 'Bitte einen Namen angeben.',
		cover: 'Als Titelbild',
		saveAndNext: 'Speichern & weitere',
		created: (name: string) => `„${name}“ angelegt.`,
		view: 'Ansehen',
		photoHint: 'Das Foto wird als Ereignis gespeichert und als Titelbild verwendet.',
		isCover: 'Titelbild',
		deleteHint:
			'Löschen entfernt das Objekt mit seiner ganzen Chronik und seinen Fotos und Dateien. Ist es nur nicht mehr da (z. B. abgegeben), setze es besser auf inaktiv: Dann bleibt seine Geschichte erhalten.',
		confirmDelete: (name: string, impact: { events: number; files: number }) =>
			confirmWithEvents(`„${name}“`, impact) +
			'\n\nWenn das Objekt nur nicht mehr da ist: lieber abbrechen und auf inaktiv setzen.',
		timeline: 'Chronik',
		addEvent: 'Ereignis erfassen',
		takePhoto: 'Foto aufnehmen',
		fromGallery: 'Aus Galerie',
		photos: 'Fotos & Videos',
		key: 'Eigenschaft',
		value: 'Wert'
	},
	events: {
		title: 'Ereignisse',
		new: 'Ereignis erfassen',
		edit: 'Ereignis bearbeiten',
		confirmDelete: (type: string, date: string) => `„${type}“ vom ${date} löschen?`,
		objects: 'Objekt(e)',
		chooseObjects: 'Objekte wählen',
		selectedObjects: (n: number) => (n === 1 ? '1 Objekt' : `${n} Objekte`),
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
		targetObject: 'als Eigenschaft des Objekts',
		targetObjectHint:
			'Wird zur Eigenschaft des Objekts, die dieses Ereignis ab seinem Datum ändert.',
		changesProperty: 'ändert Eigenschaft',
		tagProperty: 'Eigenschaft',
		tagDetail: 'Angabe',
		becomesProperty: (key: string, count: number) =>
			`Auch ${count === 1 ? 'die bisherige Angabe' : `die bisherigen ${count} Angaben`} „${key}“ ${count === 1 ? 'wird' : 'werden'} dann zur Änderung der Eigenschaft ihres Objekts.`,
		before: (v: string) => `vorher: ${v}`,
		previous: 'Wert davor:',
		previousValue: 'eintragen …',
		previousOther: 'anderer Wert …',
		previousPlaceholder: 'Wert vor dieser Änderung',
		previousHint:
			'Die erste erfasste Änderung kann den Wert davor festhalten (oder als nicht erfasst markieren).',
		photos: 'Fotos & Dateien',
		camera: 'Kamera',
		gallery: 'Galerie',
		exifDate: (d: string) => `Aufnahmedatum übernehmen: ${d}`,
		newTypeIn: (name: string, category: string) => `Neuer Ereignistyp „${name}“ in „${category}“`,
		chooseCategory: (name: string) =>
			`„${name}“ gibt es in mehreren Kategorien. Welche ist gemeint?`,
		categoryRequired: 'Bitte eine Kategorie wählen.',
		applyToBatch: (n: number) =>
			`Änderungen auf alle ${n} Ereignisse dieser Sammelbuchung anwenden`,
		batch: (n: number) => `Sammelbuchung (${n})`,
		removePhoto: 'Entfernen',
		noObjects: 'Bitte mindestens ein Objekt wählen.',
		noType: 'Bitte ein Ereignis angeben.',
		badDate: 'Bitte ein gültiges Datum angeben.',
		saved: (n: number) => (n === 1 ? 'Ereignis gespeichert.' : `${n} Ereignisse gespeichert.`),
		empty: 'Keine Ereignisse gefunden.',
		from: 'von',
		to: 'bis',
		allObjects: 'Alle Objekte',
		allTypes: 'Alle Ereignisse',
		allCategories: 'Alle Kategorien',
		more: 'Mehr anzeigen',
		searchPlaceholder: 'Ereignis oder Notiz durchsuchen',
		showMore: 'Ganzen Text anzeigen',
		showLess: 'Weniger anzeigen',
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
		deleteHint:
			'Löschen entfernt den Ereignistyp mit allen seinen Ereignissen und deren Fotos und Dateien. Eigenschaften, die diese Ereignisse gesetzt haben, fallen auf den vorherigen Wert zurück. Um ihn mit einem anderen Typ zusammenzulegen, stattdessen „Daten pflegen“ nutzen.',
		confirmDelete: (name: string, impact: { events: number; files: number }) =>
			confirmWithEvents(`Ereignistyp „${name}“`, impact),
		categoryTaken: (name: string, category: string) =>
			`In „${category || 'Ohne Kategorie'}“ gibt es „${name}“ schon. Zum Zusammenführen „Daten pflegen“ nutzen.`,
		deleteCategory: 'Kategorie löschen',
		confirmDeleteCategory: (
			category: string,
			types: number,
			impact: { events: number; files: number }
		) =>
			confirmWithEvents(
				`Kategorie „${category}“ mit ${n(types, 'Ereignistyp', 'Ereignistypen')}`,
				impact
			) +
			'\n\nEigenschaften, die diese Ereignisse gesetzt haben, fallen auf den vorherigen Wert zurück.',
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
	fieldKinds: {
		kind: 'Art der Werte',
		names: { text: 'Text', date: 'Datum', number: 'Zahl' },
		unit: 'Einheit',
		unitPlaceholder: 'z. B. cm',
		saved: (key: string) => `„${key}“ gespeichert.`
	},
	files: {
		add: 'Datei',
		dropHint: 'oder Dateien hierher ziehen',
		view: 'Ansehen',
		uploading: (done: number, total: number) => `Lade hoch … ${done}/${total}`,
		tooLarge: (name: string, max?: number) =>
			`„${name}“ ist zu groß für den Server` +
			(max ? ` (höchstens ${Math.floor(max / 1024 ** 2)} MB pro Datei).` : '.'),
		uploadFailed: (name: string) => `„${name}“ konnte nicht hochgeladen werden.`,
		missing: 'Eine hochgeladene Datei fehlt. Bitte die Dateien erneut hinzufügen.'
	},
	gallery: {
		showAll: (n: number) => `Alle ${n} anzeigen`,
		longPressHint: 'Lange drücken, um ein Foto als Titelbild zu wählen.',
		coverHelp: 'Wie wähle ich das Titelbild?',
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
		saved: 'Gespeichert.',
		propertyOrder: 'Reihenfolge der Eigenschaften',
		propertyOrderHint:
			'In dieser Reihenfolge stehen die Eigenschaften auf jedem Objekt und im Formular. Neue Eigenschaften kommen ans Ende, alphabetisch.',
		alphabetical: 'Alphabetisch sortieren',
		noProperties: 'Noch keine Eigenschaften.'
	},
	more: {
		title: 'Mehr',
		switchDiary: 'Alle Tagebücher'
	},
	diary: {
		title: 'Tagebuch',
		menu: (sharing: boolean, owner: boolean) =>
			!sharing ? 'Tagebuch' : owner ? 'Tagebuch & Teilen' : 'Tagebuch & Mitglieder',
		name: 'Name',
		roles: { owner: 'Besitzer', editor: 'Kann bearbeiten', viewer: 'Nur ansehen' },
		yourRole: (role: string) => `Deine Berechtigung: ${role}`,
		share: 'Teilen',
		shareHint:
			'Erstelle einen Einladungslink und schicke ihn der Person, mit der du das Tagebuch teilen willst. Er gilt 7 Tage und nur für eine Person; sie meldet sich mit ihrem eigenen Konto an.',
		role: 'Berechtigung',
		createInvite: 'Einladungslink erstellen',
		inviteCreated: 'Einladungslink (wird nur jetzt angezeigt):',
		copy: 'Kopieren',
		copied: 'Kopiert',
		shareLink: 'Teilen…',
		shareText: (name: string) => `Einladung zum Tagebuch „${name}“`,
		openInvites: 'Offene Einladungen',
		inviteLine: (role: string, until: string) => `${role}, gültig bis ${until}`,
		revoke: 'Widerrufen',
		members: 'Mitglieder',
		you: 'du',
		remove: 'Entfernen',
		confirmRemove: (user: string) =>
			`${user} aus dem Tagebuch entfernen? Der Zugriff endet sofort.`,
		leave: 'Tagebuch verlassen',
		confirmLeave: (name: string) =>
			`„${name}“ verlassen? Um wieder Zugriff zu bekommen, brauchst du eine neue Einladung.`,
		delete: 'Tagebuch löschen',
		deleteHint:
			'Löscht das Tagebuch mit allen Objekten, Ereignissen, Fotos und Dateien, auch für alle, mit denen es geteilt ist.',
		confirmDelete: (name: string, c: { objects: number; events: number; files: number }) =>
			`Tagebuch „${name}“ mit ${n(c.objects, 'Objekt', 'Objekten')}, ${n(c.events, 'Ereignis', 'Ereignissen')} und ${n(c.files, 'Datei', 'Dateien')} endgültig löschen? Das kann nicht rückgängig gemacht werden.`
	},
	invite: {
		title: 'Einladung',
		text: (by: string, name: string, role: string) =>
			`${by} lädt dich zum Tagebuch „${name}“ ein. Berechtigung: ${role}.`,
		accept: 'Annehmen',
		invalid:
			'Dieser Einladungslink ist ungültig, schon benutzt oder abgelaufen. Bitte um einen neuen.',
		already: 'Du hast bereits Zugriff auf dieses Tagebuch.',
		open: 'Tagebuch öffnen'
	},
	diaries: {
		title: 'Tagebücher',
		empty: 'Noch kein Tagebuch vorhanden.',
		new: 'Neues Tagebuch',
		name: 'Name',
		nameRequired: 'Bitte einen Namen angeben.',
		type: 'Art',
		types: { objects: 'Ereignistagebuch' },
		create: 'Anlegen',
		shareHint: 'Für welches Tagebuch sind die geteilten Fotos?'
	},
	shortcuts: {
		title: 'Tastenkürzel',
		hint: 'Am Computer; auf dem Mac mit ⌘ statt Strg.',
		modifier: 'Strg',
		home: 'Übersicht',
		newObject: 'Neues Objekt',
		newEvent: 'Ereignis erfassen (auf einer Objektseite für dieses Objekt)',
		search: 'Objekte durchsuchen',
		save: 'Formular speichern'
	},
	errors: {
		notFound: 'Nicht gefunden.',
		forbidden: 'Dafür fehlt die Berechtigung.',
		generic: 'Etwas ist schiefgelaufen.'
	}
};
