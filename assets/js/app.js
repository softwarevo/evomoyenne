// ==================== DATA MANAGEMENT ====================
        const defaultSubjects = [
            { id: 'maths', name: 'Mathématiques', coef: 3, notes: [], isDefault: true },
            { id: 'francais', name: 'Français', coef: 3, notes: [], isDefault: true },
            { id: 'histoire', name: 'Histoire-Géo', coef: 2, notes: [], isDefault: true },
            { id: 'anglais', name: 'Anglais', coef: 2, notes: [], isDefault: true },
            { id: 'lv2', name: 'Allemand/Espagnol', coef: 2, notes: [], isDefault: true },
            { id: 'physique', name: 'Physique-Chimie', coef: 1, notes: [], isDefault: true },
            { id: 'svt', name: 'SVT', coef: 1, notes: [], isDefault: true },
            { id: 'techno', name: 'Technologie', coef: 1, notes: [], isDefault: true },
            { id: 'latin', name: 'Latin', coef: 1, notes: [], isDefault: true },
            { id: 'eps', name: 'EPS', coef: 1, notes: [], isDefault: true },
            { id: 'art', name: 'Art Plastique', coef: 1, notes: [], isDefault: true },
            { id: 'musique', name: 'Musique', coef: 1, notes: [], isDefault: true },
        ];

        let data = {
            subjects: [],
            history: {},
            target: 20,
            theme: 'dark',
            calculation: {
                generalMode: 'weighted',
                generalTruncated: false,
                subjectMode: 'weighted',
                subjectTruncated: false
            },
            auth: {
                token: null,
                '2faToken': null,
                deviceUUID: null,
                accountId: null,
                identifiant: null,
                motdepasse: null,
                identity: { prenom: null, nom: null }
            }
        };

        const dbPromise = idb.openDB('evoMoyenne', 3, {
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

        async function loadData() {
            try {
                const db = await dbPromise;

                // Load settings
                const settings = await db.get('settings', 'app');
                if (settings) {
                    data.target = settings.target ?? 20;
                    data.theme = settings.theme ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                    data.history = settings.history ?? {};
                    if (settings.calculation) {
                        data.calculation = { ...data.calculation, ...settings.calculation };
                    }
                } else {
                    data.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }

                // Load auth profile
                const authProfile = await db.get('auth', 'profile');
                if (authProfile) {
                    data.auth = { ...data.auth, ...authProfile };
                }
                if (!data.auth.identity) {
                    data.auth.identity = { prenom: null, nom: null };
                }

                // Load subjects
                const subjects = await db.getAll('subjects');
                if (subjects && subjects.length > 0) {
                    data.subjects = subjects;
                } else {
                    data.subjects = JSON.parse(JSON.stringify(defaultSubjects));
                }

                // Load notes
                const allNotes = await db.getAll('notes');
                data.subjects.forEach(subject => {
                    subject.notes = allNotes.filter(n => n.subjectId === subject.id);
                });

                // Update UI elements
                document.getElementById('target-input').value = data.target;
                applyTheme(data.theme);

            } catch (err) {
                console.error("Failed to load data from IndexedDB", err);
                // Fallback to defaults
                data.subjects = JSON.parse(JSON.stringify(defaultSubjects));
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                applyTheme(systemTheme);
            }
        }

        async function clearAllData() {
            try {
                const db = await dbPromise;
                const tx = db.transaction(['subjects', 'auth', 'settings', 'notes'], 'readwrite');
                await tx.objectStore('subjects').clear();
                await tx.objectStore('auth').clear();
                await tx.objectStore('settings').clear();
                await tx.objectStore('notes').clear();
                await tx.done;
                localStorage.clear();
            } catch (err) {
                console.error("Error clearing all data:", err);
            }
        }

        async function saveData() {
            if (isDontSaveMode) return;
            try {
                const db = await dbPromise;
                const tx = db.transaction(['subjects', 'auth', 'settings'], 'readwrite');

                // Save subjects to IndexedDB for SW access
                const subjectsStore = tx.objectStore('subjects');
                await subjectsStore.clear();
                for (const s of data.subjects) {
                    await subjectsStore.put({ ...s, notes: [] });
                }

                // Save auth profile
                await tx.objectStore('auth').put(data.auth, 'profile');

                // Keep 'credentials' for SW compatibility
                if (data.auth.identifiant || data.auth.token) {
                    await tx.objectStore('auth').put({
                        identifiant: data.auth.identifiant,
                        motdepasse: data.auth.motdepasse,
                        token: data.auth.token,
                        '2faToken': data.auth['2faToken'],
                        deviceUUID: data.auth.deviceUUID,
                        accountId: data.auth.accountId
                    }, 'credentials');
                } else {
                    await tx.objectStore('auth').delete('credentials');
                }

                // Save settings
                await tx.objectStore('settings').put({
                    target: data.target,
                    theme: data.theme,
                    history: data.history,
                    calculation: data.calculation
                }, 'app');

                await tx.done;
            } catch (err) {
                console.error("Error saving data to IDB:", err);
            }
        }

        function generateId(prefix = '') {
            return prefix + crypto.randomUUID().split('-')[0];
        }

        function normalizeString(str) {
            return str.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9&]/g, '');
        }

        function matchSubject(edName) {
            const normalizedEd = normalizeString(edName);

            const mapping = {
                'mathematiques': 'maths',
                'maths': 'maths',
                'francais': 'francais',
                'histoiregeographie': 'histoire',
                'histoiregeo': 'histoire',
                'anglaislv1': 'anglais',
                'anglaislv2': 'anglais',
                'anglais': 'anglais',
                'allemandlv2': 'lv2',
                'espagnollv2': 'lv2',
                'allemand': 'lv2',
                'espagnol': 'lv2',
                'physiquechimie': 'physique',
                'sciencesvieetterre': 'svt',
				'sciencesvie&terre': 'svt',
                'svt': 'svt',
                'technologie': 'techno',
                'techno': 'techno',
                'educationphysiqueetsportive': 'eps',
				'edphysique&sport': 'eps',
                'eps': 'eps',
                'artsplastiques': 'art',
                'artplastique': 'art',
                'educationmusicale': 'musique',
                'musique': 'musique',
                'latin': 'latin'
            };

            for (const [key, id] of Object.entries(mapping)) {
                if (normalizedEd === key || normalizedEd.includes(key)) {
                    const subject = data.subjects.find(s => s.id === id);
                    if (subject) return subject;
                }
            }

            for (const subject of data.subjects) {
                const normalizedSub = normalizeString(subject.name);
                if (normalizedEd === normalizedSub || normalizedEd.includes(normalizedSub) || normalizedSub.includes(normalizedEd)) {
                    return subject;
                }
            }

            return null;
        }

        // ==================== STATE MANAGEMENT ====================
        let isLoggedOut = true;
        let isDontSaveMode = false;
        let userSession = null;
        let tempAuth = {};

        // ==================== CALCULATIONS ====================
        function calculateWeightedMedian(items) {
            if (items.length === 0) return null;
            items.sort((a, b) => a.value - b.value);
            const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
            const threshold = totalWeight / 2;

            let cumulativeWeight = 0;
            for (let i = 0; i < items.length; i++) {
                cumulativeWeight += items[i].weight;
                if (cumulativeWeight > threshold) {
                    return items[i].value;
                }
                if (Math.abs(cumulativeWeight - threshold) < 1e-9) {
                    if (i + 1 < items.length) {
                        return (items[i].value + items[i + 1].value) / 2;
                    } else {
                        return items[i].value;
                    }
                }
            }
            return items[items.length - 1].value;
        }

        function calculateSubjectAverage(subject, includeGhost = true, atDate = null, overrideSettings = null) {
            const calcSettings = overrideSettings || data.calculation;
            let notes = (subject.notes || []).filter(n => !n.hidden);
            if (!includeGhost) notes = notes.filter(n => !n.ghost);

            if (atDate) {
                const atDateTime = new Date(atDate).getTime();
                notes = notes.filter(n => n.date && new Date(n.date.split('T')[0]).getTime() <= atDateTime);
            }

            notes = notes.filter(n => typeof n.value === 'number');
            if (notes.length === 0) return null;

            if (calcSettings.subjectMode === 'median') {
                const items = notes.map(n => ({
                    value: (n.value / n.max) * 20,
                    weight: n.coef
                }));
                return calculateWeightedMedian(items);
            } else {
                // weighted
                let effectiveNotes = [...notes];
                if (calcSettings.subjectTruncated && effectiveNotes.length >= 2) {
                    effectiveNotes.sort((a, b) => (a.value / a.max) - (b.value / b.max));
                    const secondMin = { ...effectiveNotes[1] };
                    const secondMax = { ...effectiveNotes[effectiveNotes.length - 2] };
                    effectiveNotes[0] = secondMin;
                    effectiveNotes[effectiveNotes.length - 1] = secondMax;
                }

                let totalWeighted = 0;
                let totalCoef = 0;
                effectiveNotes.forEach(note => {
                    const normalized = (note.value / note.max) * 20;
                    totalWeighted += normalized * note.coef;
                    totalCoef += note.coef;
                });
                return totalCoef > 0 ? totalWeighted / totalCoef : null;
            }
        }

        function calculateGeneralAverage(includeGhost = true, atDate = null, forceOfficial = false) {
            let calcSettings = data.calculation;
            let subjCalcSettings = data.calculation;

            if (forceOfficial) {
                calcSettings = { generalMode: 'subjects', generalTruncated: false };
                subjCalcSettings = { subjectMode: 'weighted', subjectTruncated: false };
            }

            if (calcSettings.generalMode === 'weighted') {
                let allNotes = [];
                data.subjects.forEach(subject => {
                    let notes = (subject.notes || []).filter(n => !n.hidden);
                    if (!includeGhost) notes = notes.filter(n => !n.ghost);
                    if (atDate) {
                        const atDateTime = new Date(atDate).getTime();
                        notes = notes.filter(n => n.date && new Date(n.date.split('T')[0]).getTime() <= atDateTime);
                    }
                    notes = notes.filter(n => typeof n.value === 'number');
                    notes.forEach(n => {
                        allNotes.push({
                            valueOn20: (n.value / n.max) * 20,
                            coef: n.coef * subject.coef
                        });
                    });
                });

                if (allNotes.length === 0) return null;

                if (calcSettings.generalTruncated && allNotes.length >= 2) {
                    allNotes.sort((a, b) => a.valueOn20 - b.valueOn20);
                    const secondMin = { ...allNotes[1] };
                    const secondMax = { ...allNotes[allNotes.length - 2] };
                    allNotes[0] = secondMin;
                    allNotes[allNotes.length - 1] = secondMax;
                }

                let totalPoints = 0;
                let totalCoefs = 0;
                allNotes.forEach(n => {
                    totalPoints += n.valueOn20 * n.coef;
                    totalCoefs += n.coef;
                });
                return totalCoefs > 0 ? totalPoints / totalCoefs : null;

            } else if (calcSettings.generalMode === 'subjects') {
                let subjectAverages = data.subjects.map(s => {
                    return {
                        avg: calculateSubjectAverage(s, includeGhost, atDate, subjCalcSettings),
                        coef: s.coef
                    };
                }).filter(s => s.avg !== null);

                if (subjectAverages.length === 0) return null;

                if (calcSettings.generalTruncated && subjectAverages.length >= 2) {
                    subjectAverages.sort((a, b) => a.avg - b.avg);
                    const secondMin = { ...subjectAverages[1] };
                    const secondMax = { ...subjectAverages[subjectAverages.length - 2] };
                    subjectAverages[0] = secondMin;
                    subjectAverages[subjectAverages.length - 1] = secondMax;
                }

                let totalPoints = 0;
                let totalCoefs = 0;
                subjectAverages.forEach(s => {
                    totalPoints += s.avg * s.coef;
                    totalCoefs += s.coef;
                });
                return totalCoefs > 0 ? totalPoints / totalCoefs : null;

            } else if (calcSettings.generalMode === 'median') {
                let allItems = [];
                data.subjects.forEach(subject => {
                    let notes = (subject.notes || []).filter(n => !n.hidden);
                    if (!includeGhost) notes = notes.filter(n => !n.ghost);
                    if (atDate) {
                        const atDateTime = new Date(atDate).getTime();
                        notes = notes.filter(n => n.date && new Date(n.date.split('T')[0]).getTime() <= atDateTime);
                    }
                    notes = notes.filter(n => typeof n.value === 'number');
                    notes.forEach(n => {
                        allItems.push({
                            value: (n.value / n.max) * 20,
                            weight: n.coef * subject.coef
                        });
                    });
                });

                if (allItems.length === 0) return null;
                return calculateWeightedMedian(allItems);
            }
            return null;
        }

        function getTopFlop() {
            const subjectsWithAvg = data.subjects
                .map(s => ({ name: s.name, avg: calculateSubjectAverage(s) }))
                .filter(s => s.avg !== null)
                .sort((a, b) => b.avg - a.avg);
            
            return {
                top: subjectsWithAvg.slice(0, 3),
                flop: subjectsWithAvg.slice(-3).reverse()
            };
        }

        function getTodayKey() {
            return new Date().toISOString().split('T')[0];
        }

        function rebuildHistory() {
            // If no real notes are present, we don't rebuild history to avoid clearing persisted data
            const hasRealNotes = data.subjects.some(s => s.notes.some(n => !n.ghost));
            if (!hasRealNotes) return;

            const allDates = new Set();
            data.subjects.forEach(subject => {
                subject.notes.forEach(note => {
                    if (!note.ghost && note.date) {
                        const d = note.date.split('T')[0];
                        allDates.add(d);
                    }
                });
            });

            // Tri robuste par date
            const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
            data.history = {};
            
            sortedDates.forEach(date => {
                const avg = calculateGeneralAverage(false, date);
                if (avg !== null) {
                    data.history[date] = parseFloat(avg.toFixed(2));
                }
            });
            saveData();
        }

        function getEvolution() {
            // Collecte toutes les dates uniques des notes réelles non cachées
            const allDates = new Set();
            data.subjects.forEach(subject => {
                subject.notes.forEach(note => {
                    if (!note.ghost && !note.hidden && note.date) {
                        allDates.add(note.date.split('T')[0]);
                    }
                });
            });

            // Tri robuste par date
            const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
            if (sortedDates.length < 2) return null;

            // La "dernière note" correspond au groupe de notes de la date la plus récente
            // On compare la moyenne actuelle réelle à la moyenne réelle avant cette date
            const currentAvg = calculateGeneralAverage(false);
            const previousAvg = calculateGeneralAverage(false, sortedDates[sortedDates.length - 2]);

            if (currentAvg !== null && previousAvg !== null) {
                return currentAvg - previousAvg;
            }
            return null;
        }

        // ==================== UI UPDATES ====================
        function updateAverageDisplay(suppressConfetti = false) {
            const avg = calculateGeneralAverage();
            const avgEl = document.getElementById('average-value');
            const evolutionEl = document.getElementById('average-evolution');
            const evolutionText = document.getElementById('evolution-text');
            
            if (avg !== null) {
                const oldAvg = parseFloat(avgEl.textContent) || 0;
                avgEl.textContent = avg.toFixed(2);
                
                if (oldAvg > 0 && avg > oldAvg && !suppressConfetti) {
                    triggerConfetti();
                }
            } else {
                avgEl.textContent = '--';
            }
            
            const evolution = getEvolution();
            if (evolution !== null) {
                const sign = evolution >= 0 ? '+' : '';
                evolutionText.textContent = `${sign}${evolution.toFixed(2)} depuis dernière note`;
                evolutionEl.className = 'average-evolution';
                const icon = evolutionEl.querySelector('.material-symbols-rounded');
                
                if (evolution > 0) {
                    icon.textContent = 'trending_up';
                    evolutionText.classList.add('evolution-positive');
                    evolutionText.classList.remove('evolution-negative', 'evolution-neutral');
                } else if (evolution < 0) {
                    icon.textContent = 'trending_down';
                    evolutionText.classList.add('evolution-negative');
                    evolutionText.classList.remove('evolution-positive', 'evolution-neutral');
                } else {
                    icon.textContent = 'trending_flat';
                    evolutionText.classList.add('evolution-neutral');
                    evolutionText.classList.remove('evolution-positive', 'evolution-negative');
                }
            }
            
            updateTargetProgress();
        }

        function updateTargetProgress() {
            const avg = calculateGeneralAverage();
            const target = parseFloat(document.getElementById('target-input').value) || 20;
            
            const progressBar = document.getElementById('target-progress');
            const progressCurrent = document.getElementById('progress-current');
            const progressRemaining = document.getElementById('progress-remaining');
            
            if (avg !== null) {
                const percentage = Math.min(100, (avg / target) * 100);
                progressBar.style.width = percentage + '%';
                progressCurrent.textContent = avg.toFixed(2);
                
                const remaining = Math.max(0, target - avg);
                if (remaining > 0) {
                    progressRemaining.textContent = `Il reste ${remaining.toFixed(2)} pts`;
                } else {
                    progressRemaining.textContent = '🎉 Objectif atteint !';
                }
            } else {
                progressBar.style.width = '0%';
                progressCurrent.textContent = '0.00';
                progressRemaining.textContent = `Il reste ${target.toFixed(2)} pts`;
            }
        }

        function updateTopFlop() {
            const { top, flop } = getTopFlop();
            
            const topList = document.getElementById('top-list');
            const flopList = document.getElementById('flop-list');
            
            topList.innerHTML = top.map(s => `
                <div class="topflop-item">
                    <span class="topflop-subject">${s.name}</span>
                    <span class="topflop-average" style="color: #4caf50;">${s.avg.toFixed(2)}</span>
                </div>
            `).join('') || '<p style="font-size: 13px; color: var(--md-sys-color-on-surface-variant);">Aucune note</p>';
            
            flopList.innerHTML = flop.map(s => `
                <div class="topflop-item">
                    <span class="topflop-subject">${s.name}</span>
                    <span class="topflop-average" style="color: #f44336;">${s.avg.toFixed(2)}</span>
                </div>
            `).join('') || '<p style="font-size: 13px; color: var(--md-sys-color-on-surface-variant);">Aucune note</p>';
        }

        function updateSubjectSelect() {
            const select = document.getElementById('note-subject');
            select.innerHTML = '<option value="">Sélectionner...</option>' +
                data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        function updateSubjectsList() {
            const container = document.getElementById('subjects-container');
            
            if (data.subjects.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <span class="material-symbols-rounded">folder_off</span>
                        <h3>Aucune matière</h3>
                        <p>Ajoute ta première matière pour commencer</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = data.subjects.map(subject => {
                const avg = calculateSubjectAverage(subject);
                const recentNotes = subject.notes.slice(-3).reverse();
                const hasMore = subject.notes.length > 3;
                
                return `
                    <div class="card subject-card" data-subject="${subject.id}">
                        <div class="subject-header">
                            <div class="subject-info" onclick="toggleSubject('${subject.id}')">
                                <div class="subject-name">
                                    ${subject.name}
                                    <span class="subject-coef">×${subject.coef}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="subject-average-pill" onclick="toggleSubject('${subject.id}')">${avg !== null ? avg.toFixed(2) : '--'}</div>
                            </div>
                        </div>
                        <div class="notes-list" id="notes-${subject.id}" style="display: none;">
                            ${subject.notes.length === 0 ? 
                                '<p style="text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: 13px; padding: 16px 0;">Aucune note</p>' :
                                recentNotes.map(note => renderNote(subject.id, note)).join('')
                            }
                            ${hasMore ? `
                                <button class="see-all-btn" onclick="showAllNotes('${subject.id}')">
                                    <span class="material-symbols-rounded">expand_more</span>
                                    Voir tout (${subject.notes.length} notes)
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderNote(subjectId, note) {
            const isNumeric = typeof note.value === 'number';
            const valueDisplay = isNumeric ? `${note.value}/${note.max}` : note.value;

            const isModified = note.originalValue !== undefined;
            const isHidden = note.hidden;

            let details = `Coef ${note.coef} • ${new Date(note.date).toLocaleDateString('fr-FR')}`;
            if (isModified) {
                details += ` (Original: ${note.originalValue}/${note.originalMax})`;
            }

            const isPureGhost = note.ghost && !isModified;
            const itemClass = (note.ghost || isHidden) ? 'ghost' : '';
            const ghostClass = isPureGhost ? 'pure-ghost' : '';
            const hiddenClass = isHidden ? 'hidden-note' : '';
            const infoClass = isHidden ? 'strikethrough' : '';

            const actionIcon = isPureGhost ? 'delete' : (isHidden ? 'visibility' : 'visibility_off');
            const actionTitle = isPureGhost ? 'Supprimer' : (isHidden ? 'Afficher' : 'Masquer');
            const actionClass = isPureGhost ? 'delete' : 'hide-note';

            return `
                <div class="note-item ${itemClass} ${ghostClass} ${hiddenClass}" data-note="${note.id}">
                    <div class="note-info ${infoClass}">
                        <span class="note-value">${valueDisplay}</span>
                        <span class="note-details">${details}</span>
                    </div>
                    <div class="note-actions">
                        <button class="note-action-btn" onclick="editNote('${subjectId}', '${note.id}')" title="Modifier">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="note-action-btn ${actionClass}" onclick="deleteNote('${subjectId}', '${note.id}')" title="${actionTitle}">
                            <span class="material-symbols-rounded">${actionIcon}</span>
                        </button>
                    </div>
                </div>
            `;
        }

        function toggleSubject(subjectId) {
            const notesList = document.getElementById(`notes-${subjectId}`);
            notesList.style.display = notesList.style.display === 'none' ? 'block' : 'none';
            hapticFeedback();
        }

        function showAllNotes(subjectId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            const notesList = document.getElementById(`notes-${subjectId}`);
            notesList.innerHTML = subject.notes.slice().reverse().map(note => renderNote(subjectId, note)).join('');
        }

        function showLoginTip() {
            const tip = document.getElementById('login-tip');
            const dropdown = document.getElementById('profile-dropdown');
            const isMenuOpen = dropdown && dropdown.classList.contains('visible');

            if (tip && isLoggedOut && !isMenuOpen) {
                tip.classList.remove('hidden');
            }
        }

        function hideLoginTip() {
            const tip = document.getElementById('login-tip');
            if (tip) {
                tip.classList.add('hidden');
            }
        }

        function updateSettingsDialog() {
            const checkbox = document.getElementById('dont-save-checkbox');
            if (isDontSaveMode) {
                checkbox.classList.add('checked');
            } else {
                checkbox.classList.remove('checked');
            }

            // Update radio buttons
            document.querySelectorAll('input[name="general-mode"]').forEach(radio => {
                radio.checked = radio.value === data.calculation.generalMode;
            });
            document.querySelectorAll('input[name="subject-mode"]').forEach(radio => {
                radio.checked = radio.value === data.calculation.subjectMode;
            });

            // Update checkboxes
            const genTrunc = document.getElementById('general-truncated-checkbox');
            if (data.calculation.generalTruncated) genTrunc.classList.add('checked');
            else genTrunc.classList.remove('checked');

            const subTrunc = document.getElementById('subject-truncated-checkbox');
            if (data.calculation.subjectTruncated) subTrunc.classList.add('checked');
            else subTrunc.classList.remove('checked');
        }

        function updateAboutDialog() {
            const officialAvg = calculateGeneralAverage(true, null, true);

            const isOfficial = data.calculation.generalMode === 'subjects' &&
                               data.calculation.subjectMode === 'weighted' &&
                               !data.calculation.generalTruncated &&
                               !data.calculation.subjectTruncated;

            const disclaimer = document.getElementById('official-disclaimer');
            const avgValEl = document.getElementById('official-avg-value');

            if (!isOfficial && officialAvg !== null) {
                disclaimer.style.display = 'block';
                avgValEl.textContent = officialAvg.toFixed(2);
            } else {
                disclaimer.style.display = 'none';
            }
        }

        function updateProfileUI() {
            const profileBtn = document.getElementById('profile-trigger');
            const dropdown = document.getElementById('profile-dropdown');
    
            if (!profileBtn || !dropdown) return;

            if (isLoggedOut) {
                showLoginTip();
                profileBtn.innerHTML = `
                    <div class="profile-avatar" style="background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-on-surface);">
                        <span class="material-symbols-rounded">login</span>
                    </div>
                    <span class="profile-name">Se connecter</span>
                `;

                dropdown.innerHTML = `
                    <div class="login-container">
                        <h3 class="dropdown-title">Connexion</h3>
                        <div class="form-group">
                            <input type="text" class="form-input small-input" placeholder="Identifiant">
                        </div>
                        <div class="form-group">
                            <input type="password" class="form-input small-input" placeholder="Mot de passe">
                        </div>
                        <div class="ghost-toggle" id="remember-me-toggle" style="padding: 0; margin-bottom: 4px; cursor: pointer;">
                            <div class="checkbox-m3 checked" id="remember-me-checkbox">
                                <span class="material-symbols-rounded filled">check</span>
                            </div>
                            <label class="ghost-toggle-label" style="font-size: 13px; cursor: pointer;">Souvenez-vous de moi</label>
                        </div>
                        <div id="remember-me-disclaimer" style="display: none; font-size: 11px; color: var(--md-sys-color-on-surface-variant); margin-top: -8px; margin-bottom: 4px; padding-left: 32px; line-height: 1.2;">
                            Vous pouvez désactiver cette option dans les paramètres
                        </div>
                        <button class="add-btn" id="login-submit-btn">
                            Valider
                        </button>
                        <div class="dropdown-divider"></div>
                        <button class="dropdown-item" id="menu-about-btn">
                            <span class="material-symbols-rounded">info</span>
                            À propos
                        </button>
                        <button class="dropdown-item" id="menu-settings-btn">
                            <span class="material-symbols-rounded">settings</span>
                            Paramètres
                        </button>
                    </div>
                `;
            } else {
                const prenom = userSession?.identity?.prenom || data.auth?.identity?.prenom || '';
                const nom = userSession?.identity?.nom || data.auth?.identity?.nom || '';
                const photo = userSession?.identity?.photo || data.auth?.identity?.photo;
                const fullName = (prenom + ' ' + nom).trim();

                let avatarContent = `<span class="material-symbols-rounded">person</span>`;
                if (photo && photo.startsWith('data:image')) {
                    avatarContent = `<img src="${photo}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;">`;
                }

                profileBtn.innerHTML = `
                    <div class="profile-avatar">
                        ${avatarContent}
                    </div>
                    <span class="profile-name">${fullName || 'Utilisateur'}</span>
                `;

                dropdown.innerHTML = `
                    <button class="dropdown-item" id="menu-theme-toggle">
                        <span class="material-symbols-rounded">${data.theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                        <span id="theme-label">${data.theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}</span>
                    </button>
                    <button class="dropdown-item" id="menu-about-btn">
                        <span class="material-symbols-rounded">info</span>
                        À propos
                    </button>
                    <button class="dropdown-item" id="menu-settings-btn">
                        <span class="material-symbols-rounded">settings</span>
                        Paramètres
                    </button>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item item-danger" id="logout-btn">
                        <span class="material-symbols-rounded">logout</span>
                        Se déconnecter
                    </button>
                `;
        
                hideLoginTip();
            }
            attachMenuListeners();
        }

        function attachMenuListeners() {
            const themeToggle = document.getElementById('menu-theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTheme();
                });
            }

            const aboutBtn = document.getElementById('menu-about-btn');
            if (aboutBtn) {
                aboutBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateAboutDialog();
                    document.getElementById('about-dialog').classList.add('visible');
                    document.getElementById('profile-dropdown').classList.remove('visible');
                    hapticFeedback();
                });
            }

            const settingsBtn = document.getElementById('menu-settings-btn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateSettingsDialog();
                    document.getElementById('settings-dialog').classList.add('visible');
                    document.getElementById('profile-dropdown').classList.remove('visible');
                    hapticFeedback();
                });
            }
    
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    isLoggedOut = true;
                    userSession = null;
                    data.auth = {
                        token: null,
                        '2faToken': null,
                        deviceUUID: null,
                        accountId: null,
                        identifiant: null,
                        motdepasse: null,
                        identity: { prenom: null, nom: null }
                    };
                    await saveData();
                    updateProfileUI();
                    hapticFeedback();
                });
            }
        }

        // ==================== CHART ====================
        let evolutionChart = null;

        function initChart() {
            const ctx = document.getElementById('evolution-chart').getContext('2d');
            
            evolutionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Moyenne',
                        data: [],
                        borderColor: getComputedStyle(document.body).getPropertyValue('--md-sys-color-contrast').trim(),
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { 
                                color: 'rgba(154, 154, 154, 0.8)', 
                                font: { family: 'Inter', size: 11 }
                            }
                        },
                        y: {
                            grid: { 
                                color: 'rgba(154, 154, 154, 0.1)'
                            },
                            ticks: { 
                                color: getComputedStyle(document.body).getPropertyValue('--md-sys-color-contrast').trim(),
                                font: { family: 'Inter' },
                                stepSize: 1
                            }
                        }
                    }
                }
            });
            
            updateChart();
        }

        function updateChart() {
            if (!evolutionChart) return;
            
            const keys = Object.keys(data.history).sort().slice(-14);
            
            const chartData = keys.map(k => {
                const val = data.history[k];
                return (typeof val === 'object' && val !== null) ? val.generale : val;
            });

            if (chartData.length > 0) {
                const visibleMin = Math.min(...chartData);
                const visibleMax = Math.max(...chartData);
        
                evolutionChart.options.scales.y.min = Math.floor(visibleMin - 1);
                evolutionChart.options.scales.y.max = Math.ceil(visibleMax + 1);
            } else {
                evolutionChart.options.scales.y.min = 0;
                evolutionChart.options.scales.y.max = 20;
            }

            evolutionChart.data.labels = keys.map(k => {
                const date = new Date(k);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            });
            
            evolutionChart.data.datasets[0].data = chartData;
            
            const primaryColor = getComputedStyle(document.body).getPropertyValue('--md-sys-color-contrast').trim();
            evolutionChart.data.datasets[0].borderColor = primaryColor || '#9a9a9a';
            evolutionChart.data.datasets[0].pointBackgroundColor = primaryColor || '#9a9a9a';
            
            evolutionChart.update();
        }

        // ==================== ACTIONS ====================
        async function addNote() {
            const subjectId = document.getElementById('note-subject').value;
            const value = parseFloat(document.getElementById('note-value').value);
            const max = parseFloat(document.getElementById('note-max').value) || 20;
            const coef = parseFloat(document.getElementById('note-coef').value) || 1;
            const isGhost = true;
            
            if (!subjectId || isNaN(value)) {
                showSnackbar('Remplis tous les champs obligatoires');
                return;
            }
            
            if (value < 0 || value > max) {
                showSnackbar('Note invalide');
                return;
            }
            
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            const newNote = {
                id: generateId('simu-'),
                subjectId: subjectId,
                value,
                max,
                coef,
                ghost: isGhost,
                date: new Date().toISOString()
            };

            subject.notes.push(newNote);
            
            const db = await dbPromise;
            await db.put('notes', newNote);

            saveData();
            updateAll();
            
            document.getElementById('note-value').value = '';
            document.getElementById('note-max').value = max;
            document.getElementById('note-coef').value = '1';
            document.getElementById('note-subject').value = subjectId;
            document.getElementById('note-value').focus();
                
            hapticFeedback();
            showSnackbar('Note ajoutée !');
        }


        async function deleteNote(subjectId, noteId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            const note = subject.notes.find(n => n.id === noteId);
            if (!note) return;

            const isModified = note.originalValue !== undefined;
            const canDelete = note.ghost && !isModified;

            const db = await dbPromise;
            if (canDelete) {
                subject.notes = subject.notes.filter(n => n.id !== noteId);
                await db.delete('notes', noteId);
                showSnackbar('Note supprimée');
            } else {
                note.hidden = !note.hidden;
                await db.put('notes', note);
                showSnackbar(note.hidden ? 'Note masquée' : 'Note affichée');
            }
            
            saveData();
            updateAll();
            hapticFeedback();
        }


        let editingNote = null;

        function editNote(subjectId, noteId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            const note = subject.notes.find(n => n.id === noteId);
            if (!note) return;
            
            editingNote = { subjectId, noteId };
            
            document.getElementById('edit-note-value').value = note.value;
            document.getElementById('edit-note-max').value = note.max;
            document.getElementById('edit-note-coef').value = note.coef;
            
            const ghostCheckbox = document.getElementById('edit-ghost-checkbox');
            if (ghostCheckbox) ghostCheckbox.classList.add('checked');

            document.getElementById('edit-dialog').classList.add('visible');
        }

        async function saveEdit() {
            if (!editingNote) return;
            
            const subject = data.subjects.find(s => s.id === editingNote.subjectId);
            if (!subject) return;
            
            const note = subject.notes.find(n => n.id === editingNote.noteId);
            if (!note) return;
            
            if (!note.ghost && note.originalValue === undefined) {
                note.originalValue = note.value;
                note.originalMax = note.max;
                note.originalCoef = note.coef;
            }

            const val = parseFloat(document.getElementById('edit-note-value').value);
            if (!isNaN(val)) note.value = val;

            note.max = parseFloat(document.getElementById('edit-note-max').value) || 20;
            note.coef = parseFloat(document.getElementById('edit-note-coef').value) || 1;
            note.ghost = true;
            
            const db = await dbPromise;
            await db.put('notes', note);

            saveData();
            updateAll();
            
            document.getElementById('edit-dialog').classList.remove('visible');
            editingNote = null;
            hapticFeedback();
            showSnackbar('Note modifiée');
        }

        // ==================== DIALOGS ====================
        function openCoefDialog() {
            const list = document.getElementById('coef-list');
            list.innerHTML = data.subjects.map(s => `
                <div class="dialog-coef-item">
                    <div class="dialog-coef-name">
                        <span>${s.name}</span>
                    </div>
                    <input type="number" class="dialog-coef-input" data-subject="${s.id}" value="${s.coef}" min="0.1" max="20" step="0.1">
                </div>
            `).join('');
            
            document.getElementById('coef-dialog').classList.add('visible');
        }

        function saveCoefs() {
            const inputs = document.querySelectorAll('.dialog-coef-input');
            inputs.forEach(input => {
                const subject = data.subjects.find(s => s.id === input.dataset.subject);
                if (subject) {
                    subject.coef = parseFloat(input.value) || 1;
                }
            });
            
            saveData();
            updateAll();
            document.getElementById('coef-dialog').classList.remove('visible');
            hapticFeedback();
            showSnackbar('Coefficients sauvegardés');
        }

        // ==================== SHARE ====================
        const emojis = ['📈', '😎', '🎯', '🏆', '⭐', '🚀', '💪', '🔥', '✨', '🎓', '🤔', '📉', '💀', '🫠', '😅', '🙃'];
        let selectedEmoji = '📈';

        function initShareDialog() {
            const picker = document.getElementById('emoji-picker');
            picker.innerHTML = emojis.map(e => `
                <button class="emoji-btn ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>
            `).join('');
            
            picker.addEventListener('click', (e) => {
                if (e.target.classList.contains('emoji-btn')) {
                    picker.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
                    e.target.classList.add('selected');
                    selectedEmoji = e.target.dataset.emoji;
                    hapticFeedback();
                }
            });
        }

        async function generateShareCard() {
            const name = document.getElementById('share-name').value.trim() || 'Élève';
            const avg = calculateGeneralAverage();
            
            if (avg === null) {
                showSnackbar('Ajoute des notes d\'abord');
                return;
            }
            
            const preview = document.getElementById('share-preview');
            preview.innerHTML = `
                <div class="generated-card" id="generated-card">
                    <div class="generated-card-emoji">${selectedEmoji}</div>
                    <div class="generated-card-name">${name}</div>
                    <div class="generated-card-label">Ma moyenne générale</div>
                    <div class="generated-card-average">${avg.toFixed(2)}</div>
                    <div class="generated-card-footer">calculé avec evoMoyenne.qzz.io</div>
                </div>
            `;
            
            document.getElementById('share-form').style.display = 'none';
            preview.style.display = 'block';

            setTimeout(async () => {
                try {
                    const canvas = await html2canvas(document.getElementById('generated-card'), {
                        scale: 2,
                        backgroundColor: null
                    });

                    canvas.toBlob(async (blob) => {
                        const dateF = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
                        const fileName = `moyenne-${name.toLowerCase()}-${dateF}.png`;
            
                        const file = new File([blob], fileName, { type: 'image/png' });

                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            try {
                                await navigator.share({
                                    files: [file],
                                    title: 'Ma Moyenne',
                                    text: `Check ma moyenne : ${avg.toFixed(2)} !`
                               });
                            } catch (shareErr) {
                                console.log('Partage annulé ou échoué', shareErr);
                            }
                        } else {
                            const link = document.createElement('a');
                            link.download = fileName;
                            link.href = canvas.toDataURL();
                            link.click();
                            showSnackbar('Téléchargement lancé (partage non supporté)');
                        }
                    }, 'image/png');

                } catch (err) {
                    showSnackbar('Erreur lors de la génération');
                    console.error(err);
                }
            }, 100);
                
        }

        async function exportPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            const avg = calculateGeneralAverage();
            const date = new Date().toLocaleDateString('fr-FR');
            
            doc.setFontSize(24);
            doc.setFont(undefined, 'bold');
            doc.text('Bulletin de notes', 105, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text(`Généré le ${date} (bulletin non-officiel)`, 105, 28, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Moyenne Générale', 20, 50);
            
            doc.setFontSize(32);
            doc.text(avg !== null ? avg.toFixed(2) + '/20' : '--', 20, 65);
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text('Détail par matière', 20, 90);
            
            let y = 100;
            doc.setFontSize(11);
            
            data.subjects.forEach(subject => {
                const subjectAvg = calculateSubjectAverage(subject);
                doc.setFont(undefined, 'bold');
                doc.text(subject.name, 20, y);
                doc.setFont(undefined, 'normal');
                doc.text(`Coefficient ${subject.coef} - Moyenne: ${subjectAvg !== null ? subjectAvg.toFixed(2) : '--'}`, 20, y + 6);
                
                if (subject.notes.length > 0) {
                    const notesText = subject.notes.map(n => {
                        if (typeof n.value === 'number') {
                            return `${n.value}/${n.max}${n.ghost ? ' (sim)' : ''}`;
                        }
                        return n.value;
                    }).join(', ');
                    doc.setFontSize(9);
                    doc.text(`Notes: ${notesText}`, 25, y + 11);
                    doc.setFontSize(11);
                    y += 20;
                } else {
                    y += 14;
                }
                
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });
                
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text('Généré avec ', 104, 285, { align: 'right' }); 
            
            doc.setTextColor(0, 0, 255);
            doc.textWithLink('evoMoyenne.qzz.io', 105, 285, { url: 'https://evoMoyenne.qzz.io' });

            const dateF = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
            doc.save(`bulletin-evomoyenne-${dateF}.pdf`);
            showSnackbar('Bulletin téléchargé !');

        }

        // ==================== NAVIGATION ====================
        let currentPage = 'accueil';

        function switchPage(pageName) {
            currentPage = pageName;
            
            document.querySelectorAll('.page').forEach(page => {
                page.classList.add('hidden');
            });
            
            document.getElementById(`page-${pageName}`).classList.remove('hidden');
            
            document.querySelectorAll('.nav-item').forEach(item => {
                const icon = item.querySelector('.material-symbols-rounded');
                if (item.dataset.page === pageName) {
                    item.classList.add('active');
                    icon.classList.add('filled');
                } else {
                    item.classList.remove('active');
                    icon.classList.remove('filled');
                }
            });
            
            hapticFeedback();
        }

        // ==================== THEME ====================
        function applyTheme(theme) {
            document.body.setAttribute('data-theme', theme);
            data.theme = theme;
            
            const themeLabel = document.getElementById('theme-label');
            const themeIcon = document.getElementById('menu-theme-toggle')?.querySelector('.material-symbols-rounded');
            
            if (themeLabel && themeIcon) {
                if (theme === 'dark') {
                    themeLabel.textContent = 'Mode Clair';
                    themeIcon.textContent = 'light_mode';
                } else {
                    themeLabel.textContent = 'Mode Sombre';
                    themeIcon.textContent = 'dark_mode';
                }
            }
            
            const logo = document.getElementById('logo-img');
            logo.src = theme === 'dark' ? '/assets/logos/logo-b.png' : '/assets/logos/logo-n.png';

            const edLogo = document.getElementById('ed-logo');
            if(edLogo) edLogo.style.filter = theme === 'dark' ? 'invert(1)' : 'invert(0)';
            
            if (evolutionChart) {
                setTimeout(updateChart, 100);
            }
            
            saveData();
        }

        function toggleTheme() {
            const newTheme = data.theme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            hapticFeedback();
        }

        // ==================== UTILS ====================
        function hapticFeedback() {
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }

        function triggerConfetti() {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#666666', '#888888', '#aaaaaa', '#cccccc', '#ffffff']
            });
        }

        function showSnackbar(message) {
            const snackbar = document.getElementById('snackbar');
            snackbar.textContent = message;
            snackbar.classList.add('visible');
            
            setTimeout(() => {
                snackbar.classList.remove('visible');
            }, 3000);
        }

        function updateAll(suppressConfetti = false) {
            rebuildHistory();
            updateAverageDisplay(suppressConfetti);
            updateTopFlop();
            updateSubjectSelect();
            updateSubjectsList();
            updateChart();
        }

        async function registerPeriodicSync() {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;

                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }

                if ('periodicSync' in registration) {
                    try {
                        await registration.periodicSync.register('check-grades', {
                            minInterval: 60 * 60 * 1000,
                        });
                    } catch (err) {
                        console.warn('Periodic sync registration failed:', err);
                    }
                }
            }
        }

        // ==================== ECOLEDIRECTE BRIDGE ====================
        async function checkAutoLogin() {
            if (data.auth && (data.auth.token || (data.auth.identifiant && data.auth.motdepasse))) {
                isLoggedOut = false;
                updateProfileUI();
                handleEDLogin(data.auth.identifiant, data.auth.motdepasse, null, true);
            }
        }

        async function handleEDLogin(identifiant, motdepasse, qcmResponse = null, isSilent = false) {
            const loginBtn = document.getElementById('login-submit-btn');
            const container = document.querySelector('.login-container');
            const profileAvatar = document.querySelector('.profile-avatar');

            if (!navigator.onLine) {
                document.body.classList.add('is-offline');
                if (!isSilent) showSnackbar('Pas de connexion internet ☁️');
                return;
            } else {
                document.body.classList.remove('is-offline');
            }
            
            if (isSilent) {
                if (profileAvatar) profileAvatar.classList.add('syncing');
            } else {
                if (loginBtn) {
                    loginBtn.disabled = true;
                    loginBtn.textContent = 'Connexion...';
                }
            }

            const payload = {
                identifiant: identifiant,
                motdepasse: motdepasse
            };

            // Include stored tokens if available
            if (data.auth && data.auth.token) {
                payload.tokens = {
                    token: data.auth.token,
                    '2faToken': data.auth['2faToken'],
                    deviceUUID: data.auth.deviceUUID,
                    accountId: data.auth.accountId
                };
            }

            if (qcmResponse) {
                payload.qcmResponse = qcmResponse;
                payload.tokens = tempAuth.tokens;
            }

            try {
                const response = await fetch('https://ed.api.evomoyenne.qzz.io/', {
                    method: 'POST',
					mode: 'cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const apiData = await response.json();

                if (!response.ok) {
                    if (response.status === 401) throw new Error('Identifiants invalides');
                    throw new Error(apiData.error || 'Réponse invalide');
                }

                if (apiData.status === '2FA_REQUIRED') {
                    tempAuth = {
                        identifiant,
                        motdepasse,
                        tokens: {
                            token: apiData.token,
                            '2faToken': apiData['2faToken'],
                            deviceUUID: apiData.deviceUUID,
                            accountId: apiData.accountId
                        }
                    };

                    if (container) {
                        const buttonsHtml = apiData.qcm.propositions.map((prop, index) => `
                            <button class="add-btn challenge-btn" 
                                    onclick="handleEDLogin('${identifiant}', '${motdepasse}', '${apiData.qcm.rawPropositions[index]}')"
                                    data-raw="${apiData.qcm.rawPropositions[index]}"
                                    style="margin-top: 8px; width:100%; justify-content:center; background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-surface); flex-shrink: 0;">
                                ${prop}
                            </button>
                        `).join('');

                        container.innerHTML = `
                            <h3 style="font-size: 13px; margin-bottom: 12px; color: var(--md-sys-color-on-surface-variant);">${apiData.qcm.question}</h3>
							<div style="display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; padding: 4px; border-radius: 8px;">
                                ${buttonsHtml}
                            </div>
                        `;
                    }
                    hapticFeedback();
                    return;
                }

                if (apiData.status === 'SUCCESS') {
                    userSession = apiData;
                    isLoggedOut = false;
                    tempAuth = {};

                    // Update persistent auth data
                    data.auth.token = apiData.token || data.auth.token;
                    data.auth['2faToken'] = apiData['2faToken'] || data.auth['2faToken'];
                    data.auth.deviceUUID = apiData.deviceUUID || data.auth.deviceUUID;
                    data.auth.accountId = apiData.accountId || data.auth.accountId;
                    data.auth.identifiant = identifiant;
                    data.auth.motdepasse = motdepasse;

                    if (apiData.identity) {
                        data.auth.identity = {
                            prenom: apiData.identity.prenom || data.auth.identity.prenom,
                            nom: apiData.identity.nom || data.auth.identity.nom,
                            photo: apiData.identity.photo || data.auth.identity.photo || null
                        };
                    }

                    await saveData();

                    registerPeriodicSync();

                    // --- Synchronisation des notes EcoleDirecte ---
                    if (apiData.notes && Array.isArray(apiData.notes)) {
                        const db = await dbPromise;
                        const allLocalNotes = await db.getAll('notes');
                        const localRealNotes = allLocalNotes.filter(n => !n.id.startsWith('simu-'));

                        const edNotes = apiData.notes.filter(edNote => (edNote.valeur || "").trim() !== "");
                        const notesToPut = [];
                        const seenLocalIds = new Set();

                        edNotes.forEach(edNote => {
                            const valString = (edNote.valeur || "").trim();
                            const val = parseFloat(valString.replace(',', '.'));
                            const storedValue = isNaN(val) ? valString : val;
                            const max = parseFloat((edNote.noteSur || "").replace(',', '.')) || 20;
                            const coef = parseFloat(edNote.coef) === 0 ? 1 : (parseFloat(edNote.coef) || 1);
                            const edId = edNote.id.toString();

                            let subject = matchSubject(edNote.libelleMatiere);

                            if (!subject) {
                                const id = normalizeString(edNote.libelleMatiere) + '-' + generateId();
                                subject = {
                                    id,
                                    name: edNote.libelleMatiere,
                                    coef: 1,
                                    notes: [],
                                    isDefault: false
                                };
                                data.subjects.push(subject);
                            }

                            const newNoteData = {
                                id: edId,
                                subjectId: subject.id,
                                value: storedValue,
                                max: max,
                                coef: coef,
                                ghost: false,
                                date: edNote.date || new Date().toISOString(),
                                title: edNote.devoir || ""
                            };

                            const existing = localRealNotes.find(n => n.id === edId);
                            if (!existing) {
                                notesToPut.push(newNoteData);
                            } else {
                                seenLocalIds.add(edId);
                                // Compare data (value, date, title)
                                if (existing.value !== newNoteData.value ||
                                    existing.date !== newNoteData.date ||
                                    existing.title !== newNoteData.title ||
                                    existing.max !== newNoteData.max ||
                                    existing.coef !== newNoteData.coef) {

                                    // Preserve local properties like 'hidden' during update
                                    const mergedNote = {
                                        ...newNoteData,
                                        hidden: existing.hidden || false
                                    };
                                    notesToPut.push(mergedNote);
                                }
                            }
                        });

                        const notesToDelete = localRealNotes
                            .filter(n => !seenLocalIds.has(n.id))
                            .map(n => n.id);

                        const tx = db.transaction('notes', 'readwrite');
                        for (const note of notesToPut) tx.store.put(note);
                        for (const id of notesToDelete) tx.store.delete(id);
                        await tx.done;

                        // Rafraîchir l'état mémoire
                        const finalNotes = await db.getAll('notes');
                        data.subjects.forEach(s => {
                            s.notes = finalNotes.filter(n => n.subjectId === s.id);
                        });

                        // Nettoyage des matières disparues de l'API (et qui n'ont plus de notes locales)
                        const edSubjectIds = new Set(edNotes.map(n => matchSubject(n.libelleMatiere)?.id).filter(id => id));
                        data.subjects = data.subjects.filter(s =>
                            s.isDefault ||
                            s.notes.length > 0 ||
                            edSubjectIds.has(s.id)
                        );

                        updateAll(isSilent);
                    }
                    // --- Fin de synchronisation ---

                    updateProfileUI();
                    
                    const dropdown = document.getElementById('profile-dropdown');
                    if (dropdown) dropdown.classList.remove('visible');
                    
                    if (!isSilent) {
                        showSnackbar(`Salut ${userSession.identity.prenom} ! 👋`);
                        triggerConfetti();
                    }
                    hapticFeedback();
                } else {
                    throw new Error(apiData.message || 'Erreur inconnue');
                }

            } catch (err) {
                console.error(err);
                if (isSilent) {
                    if (navigator.onLine) {
                        showSnackbar('Session expirée, reconnecte-toi 👀');
                        isLoggedOut = true;
                        updateProfileUI();

                        setTimeout(() => {
                            const dropdown = document.getElementById('profile-dropdown');
                            if (dropdown) dropdown.classList.add('visible');
                        }, 500);
                    } else {
                        showSnackbar('Synchro impossible (Hors-ligne)');
                    }
                } else {
                    showSnackbar('Erreur : ' + (err.message || 'Connexion échouée'));
                    updateProfileUI();

                    setTimeout(() => {
                        const dropdown = document.getElementById('profile-dropdown');
                        if (dropdown) dropdown.classList.add('visible');
                    }, 100);
                }
            } finally {
                if (profileAvatar) profileAvatar.classList.remove('syncing');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Valider';
                }
            }
        }

        // ==================== EVENT LISTENERS ====================
        function initEventListeners() {
            window.addEventListener('online', () => document.body.classList.remove('is-offline'));
            window.addEventListener('offline', () => document.body.classList.add('is-offline'));

            window.addEventListener('beforeunload', (e) => {
                const hasGhostNotes = data.subjects.some(s => s.notes.some(n => n.ghost || n.hidden));
                if (hasGhostNotes) {
                    e.preventDefault();
                    e.returnValue = '';
                }
            });

            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => switchPage(item.dataset.page));
            });
            
            document.getElementById('add-note-btn').addEventListener('click', addNote);
            
            
            document.getElementById('target-input').addEventListener('change', function() {
                data.target = parseFloat(this.value) || 20;
                saveData();
                updateTargetProgress();
            });
            
            document.getElementById('coef-dialog-btn').addEventListener('click', openCoefDialog);
            
            document.getElementById('close-coef-dialog').addEventListener('click', () => {
                document.getElementById('coef-dialog').classList.remove('visible');
            });
            
            document.getElementById('save-coef-dialog').addEventListener('click', saveCoefs);
            
            document.getElementById('coef-dialog').addEventListener('click', (e) => {
                if (e.target.id === 'coef-dialog') {
                    document.getElementById('coef-dialog').classList.remove('visible');
                }
            });
            
            document.getElementById('close-edit-dialog').addEventListener('click', () => {
                document.getElementById('edit-dialog').classList.remove('visible');
                editingNote = null;
            });
            
            document.getElementById('save-edit-dialog').addEventListener('click', saveEdit);
            
            document.getElementById('edit-dialog').addEventListener('click', (e) => {
                if (e.target.id === 'edit-dialog') {
                    document.getElementById('edit-dialog').classList.remove('visible');
                    editingNote = null;
                }
            });
            
            document.getElementById('share-card-btn').addEventListener('click', () => {
                document.getElementById('share-form').style.display = 'block';
                document.getElementById('share-preview').style.display = 'none';
                document.getElementById('share-dialog').classList.add('visible');
            });

            const profileTrigger = document.getElementById('profile-trigger');
                const profileDropdown = document.getElementById('profile-dropdown');
    
                if (profileTrigger && profileDropdown) {
                    updateProfileUI();

                    profileTrigger.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isVisible = profileDropdown.classList.toggle('visible');
                        if (isVisible) {
                            hideLoginTip();
                        } else {
                            showLoginTip();
                        }
                        hapticFeedback();
                    });

                    document.addEventListener('click', (e) => {
                        const wrapper = document.querySelector('.profile-wrapper');
                        if (wrapper && !wrapper.contains(e.target)) {
                            profileDropdown.classList.remove('visible');
                            showLoginTip();
                        }
                    });
        
                    profileDropdown.addEventListener('click', async (e) => {
                        if (e.target.id === 'login-submit-btn') {
                            const inputs = profileDropdown.querySelectorAll('input');
                            const id = inputs[0].value.trim();
                            const pass = inputs[1].value.trim();

                            if (!id || !pass) {
                                showSnackbar('Il manque un truc là... 👀');
                                return;
                            }

                            const rememberCheckbox = document.getElementById('remember-me-checkbox');
                            if (rememberCheckbox && !rememberCheckbox.classList.contains('checked')) {
                                isDontSaveMode = true;
                                await clearAllData();
                            } else {
                                isDontSaveMode = false;
                            }

                            handleEDLogin(id, pass);
                        }
                        const rememberToggle = e.target.closest('#remember-me-toggle');
                        if (rememberToggle) {
                            const checkbox = rememberToggle.querySelector('.checkbox-m3');
                            const disclaimer = document.getElementById('remember-me-disclaimer');
                            const isChecked = checkbox.classList.toggle('checked');
                            if (disclaimer) disclaimer.style.display = isChecked ? 'none' : 'block';
                            hapticFeedback();
                        }
                        const challengeBtn = e.target.closest('.challenge-btn');
                        if (challengeBtn) {
                            const rawResponse = challengeBtn.dataset.raw; 
                            
                            challengeBtn.textContent = 'Vérification...';
                            challengeBtn.disabled = true;

                            handleEDLogin(tempAuth.identifiant, tempAuth.motdepasse, rawResponse);
                        }
                    });
                }

            const menuThemeToggle = document.getElementById('menu-theme-toggle');
            if (menuThemeToggle) {
                menuThemeToggle.addEventListener('click', () => {
                    toggleTheme();
                    profileDropdown.classList.remove('visible'); 
                });
            }
            
            document.getElementById('close-share-dialog').addEventListener('click', () => {
                document.getElementById('share-dialog').classList.remove('visible');
            });
            
            document.getElementById('generate-share-card').addEventListener('click', generateShareCard);
            
            document.getElementById('share-dialog').addEventListener('click', (e) => {
                if (e.target.id === 'share-dialog') {
                    document.getElementById('share-dialog').classList.remove('visible');
                }
            });
            
            document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);

            document.getElementById('close-about-dialog').addEventListener('click', () => {
                document.getElementById('about-dialog').classList.remove('visible');
            });

            document.getElementById('about-dialog').addEventListener('click', (e) => {
                if (e.target.id === 'about-dialog') {
                    document.getElementById('about-dialog').classList.remove('visible');
                }
            });

            document.getElementById('close-settings-dialog').addEventListener('click', () => {
                document.getElementById('settings-dialog').classList.remove('visible');
            });

            document.getElementById('settings-dialog').addEventListener('click', (e) => {
                if (e.target.id === 'settings-dialog') {
                    document.getElementById('settings-dialog').classList.remove('visible');
                }
            });

            document.getElementById('dont-save-toggle').addEventListener('click', async () => {
                const checkbox = document.getElementById('dont-save-checkbox');
                isDontSaveMode = checkbox.classList.toggle('checked');
                if (isDontSaveMode) {
                    await clearAllData();
                    showSnackbar('Données locales supprimées');
                }
                hapticFeedback();
            });

            document.querySelectorAll('input[name="general-mode"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    data.calculation.generalMode = e.target.value;
                    saveData();
                    updateAll();
                    hapticFeedback();
                });
            });

            document.querySelectorAll('input[name="subject-mode"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    data.calculation.subjectMode = e.target.value;
                    saveData();
                    updateAll();
                    hapticFeedback();
                });
            });

            document.getElementById('general-truncated-toggle').addEventListener('click', () => {
                const checkbox = document.getElementById('general-truncated-checkbox');
                data.calculation.generalTruncated = checkbox.classList.toggle('checked');
                saveData();
                updateAll();
                hapticFeedback();
            });

            document.getElementById('subject-truncated-toggle').addEventListener('click', () => {
                const checkbox = document.getElementById('subject-truncated-checkbox');
                data.calculation.subjectTruncated = checkbox.classList.toggle('checked');
                saveData();
                updateAll();
                hapticFeedback();
            });
                
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                applyTheme(e.matches ? 'dark' : 'light');
                    
            });

            ['note-value', 'note-max', 'note-coef'].forEach(id => {
                document.getElementById(id).addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        addNote();
                    }
                });
            });
			
            const versionBadge = document.getElementById('version-badge');
            const releaseDialog = document.getElementById('release-notes-dialog');
            const closeRelease = document.getElementById('close-release-notes');

            if (versionBadge && releaseDialog) {
                versionBadge.addEventListener('click', () => {
                    releaseDialog.classList.add('visible');
                    hapticFeedback();
                });
            }

            if (releaseDialog) {
                if (closeRelease) {
                    closeRelease.addEventListener('click', () => {
                        releaseDialog.classList.remove('visible');
                    });
                }

                releaseDialog.addEventListener('click', (e) => {
                    if (e.target === releaseDialog) {
                        releaseDialog.classList.remove('visible');
                    }
                });
            }
                
        }

        // ==================== SERVICE WORKER MANAGEMENT ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        const reg = await navigator.serviceWorker.register('/sw.js');
        
        // Check for updates every 6 hours
        setInterval(() => reg.update(), 6 * 60 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showSnackbar("Mise à jour installée !");
                    setTimeout(() => window.location.reload(), 2000);
                }
            });
        });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log("SW rafraîchi");
    });
}

        // ==================== INIT ====================
        document.addEventListener('DOMContentLoaded', async () => {
            await loadData();
            initEventListeners();
            initShareDialog();
            initChart();
            updateAll();
            checkAutoLogin();
        });
