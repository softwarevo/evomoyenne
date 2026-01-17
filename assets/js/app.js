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
            mode: 'standard',
            theme: 'dark'
        };

        function loadData() {
            const saved = localStorage.getItem('evoMoyenne');
            if (saved) {
                data = { ...data, ...JSON.parse(saved) };
            } else {
                data.subjects = JSON.parse(JSON.stringify(defaultSubjects));
            }
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            applyTheme(data.theme);
        }

        function saveData() {
            localStorage.setItem('evoMoyenne', JSON.stringify(data));
        }

        function generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        // ==================== CALCULATIONS ====================
        function calculateSubjectAverage(subject, includeGhost = true) {
            const notes = includeGhost ? subject.notes : subject.notes.filter(n => !n.ghost);
            if (notes.length === 0) return null;
            
            let totalWeighted = 0;
            let totalCoef = 0;
            
            notes.forEach(note => {
                const normalized = (note.value / note.max) * 20;
                totalWeighted += normalized * note.coef;
                totalCoef += note.coef;
            });
            
            return totalCoef > 0 ? totalWeighted / totalCoef : null;
        }

        function calculateGeneralAverage() {
            let totalWeightedPoints = 0;
            let totalWeightedCoefs = 0;

            data.subjects.forEach(subject => {
                if (subject.notes && subject.notes.length > 0) {
                    subject.notes.forEach(note => {
                        const noteSur20 = (note.value / note.max) * 20;
                        const doubleCoef = note.coef * subject.coef;
                
                        totalWeightedPoints += noteSur20 * doubleCoef;
                        totalWeightedCoefs += doubleCoef;
                    });
                }
            });

            return totalWeightedCoefs > 0 ? totalWeightedPoints / totalWeightedCoefs : null;
        }
            
            return totalCoef > 0 ? totalWeighted / totalCoef : null;
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

        function saveHistory() {
            const today = getTodayKey();
            const generale = calculateGeneralAverage('standard');
            const brute = calculateGeneralAverage('brut');
            
            if (generale !== null) {
                data.history[today] = { generale, brute };
                saveData();
            }
        }

        function getEvolution() {
            const keys = Object.keys(data.history).sort();
            if (keys.length < 2) return null;
            
            const today = keys[keys.length - 1];
            const yesterday = keys[keys.length - 2];
            
            const current = data.history[today]?.generale;
            const previous = data.history[yesterday]?.generale;
            
            if (current && previous) {
                return current - previous;
            }
            return null;
        }

        // ==================== UI UPDATES ====================
        function updateAverageDisplay() {
            const avg = calculateGeneralAverage(data.mode);
            const avgEl = document.getElementById('average-value');
            const evolutionEl = document.getElementById('average-evolution');
            const evolutionText = document.getElementById('evolution-text');
            
            if (avg !== null) {
                const oldAvg = parseFloat(avgEl.textContent) || 0;
                avgEl.textContent = avg.toFixed(2);
                
                if (oldAvg > 0 && avg > oldAvg) {
                    triggerConfetti();
                }
            } else {
                avgEl.textContent = '--';
            }
            
            const evolution = getEvolution();
            if (evolution !== null) {
                const sign = evolution >= 0 ? '+' : '';
                evolutionText.textContent = `${sign}${evolution.toFixed(2)} vs hier`;
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
            saveHistory();
        }

        function updateTargetProgress() {
            const avg = calculateGeneralAverage(data.mode);
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
                                ${!subject.isDefault ? `
                                    <button class="subject-delete-btn" onclick="deleteSubject('${subject.id}')" title="Supprimer">
                                        <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
                                    </button>
                                ` : ''}
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
            return `
                <div class="note-item ${note.ghost ? 'ghost' : ''}" data-note="${note.id}">
                    <div class="note-info">
                        <span class="note-value">${note.value}/${note.max}</span>
                        <span class="note-details">Coef ${note.coef} • ${new Date(note.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div class="note-actions">
                        <button class="note-action-btn" onclick="toggleNoteGhost('${subjectId}', '${note.id}')" title="${note.ghost ? 'Rendre réelle' : 'Rendre fantôme'}">
                            <span class="material-symbols-rounded">${note.ghost ? 'visibility' : 'visibility_off'}</span>
                        </button>
                        <button class="note-action-btn" onclick="editNote('${subjectId}', '${note.id}')" title="Modifier">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="note-action-btn delete" onclick="deleteNote('${subjectId}', '${note.id}')" title="Supprimer">
                            <span class="material-symbols-rounded">delete</span>
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
                        borderColor: getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary').trim(),
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
                                color: getComputedStyle(document.body).getPropertyValue('--md-sys-color-on-surface-variant').trim(),
                                font: { family: 'Inter' }
                            }
                        },
                        y: {
                            min: 0,
                            max: 20,
                            grid: { 
                                color: getComputedStyle(document.body).getPropertyValue('--md-sys-color-outline-variant').trim()
                            },
                            ticks: { 
                                color: getComputedStyle(document.body).getPropertyValue('--md-sys-color-on-surface-variant').trim(),
                                font: { family: 'Inter' }
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
            const isStandard = data.mode === 'standard';
            
            evolutionChart.data.labels = keys.map(k => {
                const date = new Date(k);
                return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            });
            
            evolutionChart.data.datasets[0].data = keys.map(k => {
                return isStandard ? data.history[k].generale : data.history[k].brute;
            });
            
            const primaryColor = getComputedStyle(document.body).getPropertyValue('--md-sys-color-primary').trim();
            evolutionChart.data.datasets[0].borderColor = primaryColor;
            
            evolutionChart.update();
        }

        // ==================== ACTIONS ====================
        function addNote() {
            const subjectId = document.getElementById('note-subject').value;
            const value = parseFloat(document.getElementById('note-value').value);
            const max = parseFloat(document.getElementById('note-max').value) || 20;
            const coef = parseFloat(document.getElementById('note-coef').value) || 1;
            const isGhost = document.getElementById('ghost-checkbox').classList.contains('checked');
            
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
            
            subject.notes.push({
                id: generateId(),
                value,
                max,
                coef,
                ghost: isGhost,
                date: new Date().toISOString()
            });
            
            saveData();
            updateAll();
            
            document.getElementById('note-value').value = '';
            document.getElementById('note-max').value = '20';
            document.getElementById('note-coef').value = '1';
            document.getElementById('ghost-checkbox').classList.remove('checked');
            
            hapticFeedback();
            showSnackbar('Note ajoutée !');
        }

        function addSubject() {
            const name = document.getElementById('new-subject-name').value.trim();
            const coef = parseFloat(document.getElementById('new-subject-coef').value) || 1;
            
            if (!name) {
                showSnackbar('Entre un nom de matière');
                return;
            }
            
            const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + generateId();
            
            data.subjects.push({
                id,
                name,
                coef,
                notes: [],
                isDefault: false
            });
            
            saveData();
            updateAll();
            
            document.getElementById('new-subject-name').value = '';
            document.getElementById('new-subject-coef').value = '1';
            
            hapticFeedback();
            showSnackbar('Matière créée !');
        }

        function deleteSubject(subjectId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject || subject.isDefault) return;
            
            if (confirm(`Supprimer la matière "${subject.name}" et toutes ses notes ?`)) {
                data.subjects = data.subjects.filter(s => s.id !== subjectId);
                saveData();
                updateAll();
                hapticFeedback();
                showSnackbar('Matière supprimée');
            }
        }

        function deleteNote(subjectId, noteId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            subject.notes = subject.notes.filter(n => n.id !== noteId);
            saveData();
            updateAll();
            hapticFeedback();
            showSnackbar('Note supprimée');
        }

        function toggleNoteGhost(subjectId, noteId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject) return;
            
            const note = subject.notes.find(n => n.id === noteId);
            if (!note) return;
            
            note.ghost = !note.ghost;
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
            
            const editGhostCheckbox = document.getElementById('edit-ghost-checkbox');
            if (note.ghost) {
                editGhostCheckbox.classList.add('checked');
            } else {
                editGhostCheckbox.classList.remove('checked');
            }
            
            document.getElementById('edit-dialog').classList.add('visible');
        }

        function saveEdit() {
            if (!editingNote) return;
            
            const subject = data.subjects.find(s => s.id === editingNote.subjectId);
            if (!subject) return;
            
            const note = subject.notes.find(n => n.id === editingNote.noteId);
            if (!note) return;
            
            note.value = parseFloat(document.getElementById('edit-note-value').value);
            note.max = parseFloat(document.getElementById('edit-note-max').value);
            note.coef = parseFloat(document.getElementById('edit-note-coef').value);
            note.ghost = document.getElementById('edit-ghost-checkbox').classList.contains('checked');
            
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
                        ${!s.isDefault ? `
                            <button class="dialog-delete-btn" onclick="deleteSubjectFromDialog('${s.id}')" title="Supprimer">
                                <span class="material-symbols-rounded" style="font-size: 16px;">delete</span>
                            </button>
                        ` : ''}
                        <span>${s.name}</span>
                    </div>
                    <input type="number" class="dialog-coef-input" data-subject="${s.id}" value="${s.coef}" min="0.1" max="20" step="0.1">
                </div>
            `).join('');
            
            document.getElementById('coef-dialog').classList.add('visible');
        }

        function deleteSubjectFromDialog(subjectId) {
            const subject = data.subjects.find(s => s.id === subjectId);
            if (!subject || subject.isDefault) return;
            
            if (confirm(`Supprimer la matière "${subject.name}" et toutes ses notes ?`)) {
                data.subjects = data.subjects.filter(s => s.id !== subjectId);
                saveData();
                updateAll();
                openCoefDialog();
                hapticFeedback();
                showSnackbar('Matière supprimée');
            }
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
            const avg = calculateGeneralAverage(data.mode);
            
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
                    
                    const link = document.createElement('a');
                    link.download = `evomoyenne-${name.toLowerCase()}.png`;
                    link.href = canvas.toDataURL();
                    link.click();
                    
                    showSnackbar('Image téléchargée !');
                } catch (err) {
                    showSnackbar('Erreur lors de la génération');
                }
            }, 100);
        }

        async function exportPDF() {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            const avg = calculateGeneralAverage(data.mode);
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
                    const notesText = subject.notes.map(n => `${n.value}/${n.max}${n.ghost ? ' (sim)' : ''}`).join(', ');
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
            doc.text('Généré avec ', 95, 285, { align: 'right' }); 

            doc.setTextColor(0, 0, 255);
            doc.textWithLink('evoMoyenne.qzz.io', 96, 285, { url: 'https://evoMoyenne.qzz.io' });

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
            
            const themeToggle = document.getElementById('theme-toggle');
            const icon = themeToggle.querySelector('.material-symbols-rounded');
            icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
            
            const logo = document.getElementById('logo-img');
            logo.src = theme === 'dark' ? '/assets/logos/logo-b.png' : '/assets/logos/logo-n.png';
            
            const githubLogo = document.getElementById('github-logo');
            githubLogo.style.filter = theme === 'dark' ? 'invert(1)' : 'invert(0)';

            const edLogo = document.getElementById('ed-logo');
            edLogo.style.filter = theme === 'dark' ? 'invert(1)' : 'invert(0)';
            
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

        function updateAll() {
            updateAverageDisplay();
            updateTopFlop();
            updateSubjectSelect();
            updateSubjectsList();
            updateChart();
        }

        // ==================== EVENT LISTENERS ====================
        function initEventListeners() {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', () => switchPage(item.dataset.page));
            });
            
            document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
            
            document.getElementById('mode-toggle').addEventListener('click', () => {
                const toggle = document.getElementById('mode-toggle');
                toggle.classList.toggle('active');
                data.mode = toggle.classList.contains('active') ? 'brut' : 'standard';
                
                document.getElementById('mode-standard-label').classList.toggle('active', data.mode === 'standard');
                document.getElementById('mode-brut-label').classList.toggle('active', data.mode === 'brut');
                
                saveData();
                updateAverageDisplay();
                updateChart();
                hapticFeedback();
            });
            
            document.getElementById('add-note-btn').addEventListener('click', addNote);
            
            document.getElementById('add-subject-btn').addEventListener('click', addSubject);
            
            document.getElementById('ghost-checkbox').addEventListener('click', function() {
                this.classList.toggle('checked');
                hapticFeedback();
            });
            
            document.getElementById('edit-ghost-checkbox').addEventListener('click', function() {
                this.classList.toggle('checked');
                hapticFeedback();
            });
            
            document.getElementById('target-input').addEventListener('change', function() {
                data.target = parseFloat(this.value) || 14;
                saveData();
                updateTargetProgress();
            });
            
            document.getElementById('info-btn').addEventListener('click', () => {
                document.getElementById('info-sheet').classList.add('visible');
            });
            
            document.getElementById('close-info-sheet').addEventListener('click', () => {
                document.getElementById('info-sheet').classList.remove('visible');
            });
            
            document.getElementById('info-sheet').addEventListener('click', (e) => {
                if (e.target.id === 'info-sheet') {
                    document.getElementById('info-sheet').classList.remove('visible');
                }
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
                
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                applyTheme(e.matches ? 'dark' : 'light');
                    
            });
        }

        // ==================== PWA SERVICE WORKER ====================
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                const swCode = `
                    const CACHE_NAME = 'evomoyenne';
                    const urlsToCache = ['/'];
                    
                    self.addEventListener('install', event => {
                        event.waitUntil(
                            caches.open(CACHE_NAME)
                                .then(cache => cache.addAll(urlsToCache))
                        );
                    });
                    
                    self.addEventListener('fetch', event => {
                        event.respondWith(
                            caches.match(event.request)
                                .then(response => response || fetch(event.request))
                        );
                    });
                `;
                
                const blob = new Blob([swCode], { type: 'application/javascript' });
                const swUrl = URL.createObjectURL(blob);
                
                navigator.serviceWorker.register(swUrl).catch(() => {});
            });
        }

        // ==================== INIT ====================
        document.addEventListener('DOMContentLoaded', () => {
            loadData();
            initEventListeners();
            initShareDialog();
            initChart();
            updateAll();
            
            if (data.mode === 'brut') {
                document.getElementById('mode-toggle').classList.add('active');
                document.getElementById('mode-brut-label').classList.add('active');
                document.getElementById('mode-standard-label').classList.remove('active');
            } else {
                document.getElementById('mode-standard-label').classList.add('active');
            }
        });
