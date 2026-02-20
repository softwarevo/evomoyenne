importScripts('./assets/js/idb.js');

const CACHE_NAME = 'evomoyenne-v1.2-refreshtest2';
const ASSETS = [
    './',
    './index.html',
    './assets/css/style.css',
    './assets/js/idb.js',
    './assets/js/app.js',
    './manifest.webmanifest'
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Force les onglets ouverts à passer sous le nouveau SW
});

self.addEventListener('activate', e => {
    e.waitUntil(clients.claim());
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('Cleaning old cache:', key);
                    return caches.delete(key);
                }
            })
        ))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});

// --- BACKGROUND SYNC ---

self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-grades') {
        event.waitUntil(backgroundCheck());
    }
});

async function backgroundCheck() {
    try {
        const db = await idb.openDB('evoMoyenne', 3, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    db.createObjectStore('notes', { keyPath: 'id' });
                }
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains('auth')) {
                        db.createObjectStore('auth');
                    }
                    if (!db.objectStoreNames.contains('subjects')) {
                        db.createObjectStore('subjects', { keyPath: 'id' });
                    }
                }
                if (oldVersion < 3) {
                    if (!db.objectStoreNames.contains('settings')) {
                        db.createObjectStore('settings');
                    }
                }
            },
        });

        const auth = await db.get('auth', 'credentials');
        if (!auth) return;

        const payload = {
            identifiant: auth.identifiant,
            motdepasse: auth.motdepasse,
            tokens: {
                token: auth.token,
                '2faToken': auth['2faToken'],
                deviceUUID: auth.deviceUUID,
                accountId: auth.accountId
            }
        };

        const response = await fetch('https://ed.api.evomoyenne.qzz.io/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const apiData = await response.json();
        if (apiData.status !== 'SUCCESS' || !apiData.notes) return;

        // Update tokens if provided
        const updatedAuth = {
            ...auth,
            token: apiData.token || auth.token,
            '2faToken': apiData['2faToken'] || auth['2faToken'],
            deviceUUID: apiData.deviceUUID || auth.deviceUUID,
            accountId: apiData.accountId || auth.accountId
        };
        await db.put('auth', updatedAuth, 'credentials');

        // Get existing notes and subjects
        const allNotes = await db.getAll('notes');
        const subjects = await db.getAll('subjects');
        const existingIds = new Set(allNotes.map(n => n.id.toString()));

        const edNotes = apiData.notes.filter(edNote => (edNote.valeur || "").trim() !== "");
        let newNotesFound = false;

        const tx = db.transaction(['notes', 'subjects'], 'readwrite');
        const notesStore = tx.objectStore('notes');
        const subjectsStore = tx.objectStore('subjects');

        for (const edNote of edNotes) {
            const edId = edNote.id.toString();
            if (!existingIds.has(edId)) {
                newNotesFound = true;

                let subject = matchSubject(edNote.libelleMatiere, subjects);
                if (!subject) {
                   const subId = normalizeString(edNote.libelleMatiere) + '-' + generateId();
                   subject = {
                       id: subId,
                       name: edNote.libelleMatiere,
                       coef: 1,
                       notes: [],
                       isDefault: false
                   };
                   await subjectsStore.put(subject);
                   subjects.push(subject);
                }

                const valString = (edNote.valeur || "").trim();
                const val = parseFloat(valString.replace(',', '.'));
                const storedValue = isNaN(val) ? valString : val;
                const max = parseFloat((edNote.noteSur || "").replace(',', '.')) || 20;
                const coef = parseFloat(edNote.coef) === 0 ? 1 : (parseFloat(edNote.coef) || 1);

                const elementsProgramme = (edNote.elementsProgramme || [])
                    .filter(ep => ep.valeur && ["1", "2", "3", "4"].includes(ep.valeur))
                    .map(ep => ep.valeur);

                const newNoteData = {
                    id: edId,
                    subjectId: subject.id,
                    value: storedValue,
                    max: max,
                    coef: coef,
                    ghost: false,
                    date: edNote.date || new Date().toISOString(),
                    title: edNote.devoir || "",
                    codePeriode: edNote.codePeriode || "",
                    elementsProgramme: elementsProgramme
                };

                await notesStore.put(newNoteData);
            }
        }
        await tx.done;

        if (newNotesFound) {
            self.registration.showNotification('evoMoyenne', {
                body: 'Nouvelle note détectée ! Ta moyenne a peut-être bougé. 📈',
                icon: 'assets/logos/logo-touch.png',
                badge: 'assets/logos/logo-touch.png',
                vibrate: [200, 100, 200]
            });
        }
    } catch (err) {
        console.error('Background check failed:', err);
    }
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9&]/g, '');
}

function matchSubject(edName, subjects) {
    const normalizedEd = normalizeString(edName);
    const mapping = {
        'mathematiques': 'maths', 'maths': 'maths', 'francais': 'francais',
        'histoiregeographie': 'histoire', 'histoiregeo': 'histoire',
        'anglaislv1': 'anglais', 'anglaislv2': 'anglais', 'anglais': 'anglais',
        'allemandlv2': 'lv2', 'espagnollv2': 'lv2', 'allemand': 'lv2', 'espagnol': 'lv2',
        'physiquechimie': 'physique', 'sciencesvieetterre': 'svt', 'sciencesvie&terre': 'svt', 'svt': 'svt',
        'technologie': 'techno', 'techno': 'techno', 'educationphysiqueetsportive': 'eps',
        'edphysique&sport': 'eps', 'eps': 'eps', 'artsplastiques': 'art', 'artplastique': 'art',
        'educationmusicale': 'musique', 'musique': 'musique', 'latin': 'latin'
    };

    for (const [key, id] of Object.entries(mapping)) {
        if (normalizedEd === key || normalizedEd.includes(key)) {
            const subject = subjects.find(s => s.id === id);
            if (subject) return subject;
        }
    }

    for (const subject of subjects) {
        const normalizedSub = normalizeString(subject.name);
        if (normalizedEd === normalizedSub || normalizedEd.includes(normalizedSub) || normalizedSub.includes(normalizedEd)) {
            return subject;
        }
    }
    return null;
}

function generateId(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
