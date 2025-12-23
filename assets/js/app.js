        // ===== STATE =====
        let notes = [];
        let currentTheme = 'auto';
        let isEasterEggActive = false;
        
        const themeCycle = ['light', 'dark', 'auto'];
        const themeIcons = { light: '☀️', dark: '🌙', auto: '💻' };
        const themeLabels = { light: 'Clair', dark: 'Sombre', auto: 'Auto' };
        const rainbowColors = ['#ff2400', '#ff8c00', '#e8b71d', '#1de840', '#1ddde8', '#2b1de8', '#dd00f3'];
        
        // ===== AUDIO PLAYER STATE =====
        let audio = null;
        let isAudioPlayerVisible = false;
        let isPlaying = false;
        
        // ===== DOM =====
        const html = document.documentElement;
        const favicon = document.getElementById('favicon');
        const logoIcon = document.getElementById('logoIcon');
        const noteForm = document.getElementById('noteForm');
        const notesList = document.getElementById('notesList');
        const notesCount = document.getElementById('notesCount');
        const moyenneCard = document.getElementById('moyenneCard');
        const moyenneValue = document.getElementById('moyenneValue');
        const moyenneSur = document.getElementById('moyenneSur');
        const moyenneStatus = document.getElementById('moyenneStatus');
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        const themeTooltip = document.getElementById('themeTooltip');
        const toast = document.getElementById('toast');
        
        // Audio Player DOM
        const audioPlayer = document.getElementById('audioPlayer');
        const audioPlayerIcon = document.getElementById('audioPlayerIcon');
        const audioPlayerClose = document.getElementById('audioPlayerClose');
        const audioPlayerBar = document.getElementById('audioPlayerBar');
        const audioPlayerBarFill = document.getElementById('audioPlayerBarFill');
        const audioPlayerCurrent = document.getElementById('audioPlayerCurrent');
        const audioPlayerDuration = document.getElementById('audioPlayerDuration');
        const audioPlayerPlayPause = document.getElementById('audioPlayerPlayPause');
        
        // ===== HELPERS =====
        const getEffectiveTheme = () => currentTheme === 'auto' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
            : currentTheme;
        
        const updateFavicon = () => {
            if (isEasterEggActive) {
                favicon.href = '67-kid.png';
            } else {
                favicon.href = getEffectiveTheme() === 'dark' ? 'logo-b.png' : 'logo-n.png';
            }
        };
        
        // Format time (seconds to M:SS)
        const formatTime = (seconds) => {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        // ===== AUDIO PLAYER (Easter Egg) =====
        function initAudioPlayer() {
            if (!audio) {
                audio = new Audio('assets/easter-eggs/algorithme-des-notes.mp3');
                
                // Update progress bar
                audio.addEventListener('timeupdate', () => {
                    if (audio.duration) {
                        const progress = (audio.currentTime / audio.duration) * 100;
                        audioPlayerBarFill.style.width = `${progress}%`;
                        audioPlayerCurrent.textContent = formatTime(audio.currentTime);
                    }
                });
                
                // When audio is loaded
                audio.addEventListener('loadedmetadata', () => {
                    audioPlayerDuration.textContent = formatTime(audio.duration);
                });
                
                // When audio ends
                audio.addEventListener('ended', () => {
                    isPlaying = false;
                    audioPlayerPlayPause.textContent = '▶️';
                    audioPlayerIcon.classList.remove('playing');
                    audioPlayerBarFill.style.width = '0%';
                    audio.currentTime = 0;
                });
                
                // Handle errors
                audio.addEventListener('error', () => {
                    showToast('Impossible de charger la musique', 'error');
                    hideAudioPlayer();
                });
            }
        }
        
        function showAudioPlayer() {
            initAudioPlayer();
            audioPlayer.classList.remove('closing');
            audioPlayer.classList.add('active');
            isAudioPlayerVisible = true;
            
            // Start playing
            audio.play().then(() => {
                isPlaying = true;
                audioPlayerPlayPause.textContent = '⏸️';
                audioPlayerIcon.classList.add('playing');
            }).catch(err => {
                console.error('Playback error:', err);
                showToast('Cliquez sur play pour démarrer', 'error');
            });
        }
        
        function hideAudioPlayer() {
            audioPlayer.classList.add('closing');
            
            setTimeout(() => {
                audioPlayer.classList.remove('active', 'closing');
                isAudioPlayerVisible = false;
                
                if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    isPlaying = false;
                    audioPlayerPlayPause.textContent = '▶️';
                    audioPlayerIcon.classList.remove('playing');
                    audioPlayerBarFill.style.width = '0%';
                }
            }, 300);
        }
        
        function togglePlayPause() {
            if (!audio) return;
            
            if (isPlaying) {
                audio.pause();
                isPlaying = false;
                audioPlayerPlayPause.textContent = '▶️';
                audioPlayerIcon.classList.remove('playing');
            } else {
                audio.play().then(() => {
                    isPlaying = true;
                    audioPlayerPlayPause.textContent = '⏸️';
                    audioPlayerIcon.classList.add('playing');
                });
            }
        }
        
        function seekAudio(e) {
            if (!audio || !audio.duration) return;
            
            const rect = audioPlayerBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const seekTime = (clickX / width) * audio.duration;
            
            audio.currentTime = seekTime;
        }
        
        // Double-click on logo to show player
        logoIcon.addEventListener('dblclick', (e) => {
            e.preventDefault();
            
            if (isAudioPlayerVisible) {
                hideAudioPlayer();
            } else {
                showAudioPlayer();
            }
        });
        
        // Audio player controls
        audioPlayerClose.addEventListener('click', hideAudioPlayer);
        audioPlayerPlayPause.addEventListener('click', togglePlayPause);
        audioPlayerBar.addEventListener('click', seekAudio);
        
        // ===== EASTER EGG: 67 =====
        function checkEasterEgg(moyenne) {
            const is67 = moyenne !== null && (
                Math.abs(moyenne - 6.70) < 0.001 || 
                Math.abs(moyenne - 6.07) < 0.001
            );
            
            if (is67 && !isEasterEggActive) {
                isEasterEggActive = true;
                logoIcon.classList.add('easter-egg');
                updateFavicon();
                return true;
            } else if (!is67 && isEasterEggActive) {
                isEasterEggActive = false;
                logoIcon.classList.remove('easter-egg');
                updateFavicon();
            }
            
            return is67;
        }
        
        // ===== THEME =====
        function setTheme(theme) {
            currentTheme = theme;
            html.setAttribute('data-theme', theme);
            themeIcon.textContent = themeIcons[theme];
            themeTooltip.textContent = themeLabels[theme];
            updateFavicon();
            localStorage.setItem('evoMoyenne_theme', theme);
        }
        
        themeToggle.addEventListener('click', () => {
            setTheme(themeCycle[(themeCycle.indexOf(currentTheme) + 1) % themeCycle.length]);
        });
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (currentTheme === 'auto') updateFavicon();
        });
        
        // ===== COLORS =====
        function getColorForMoyenne(m, isEaster = false) {
            if (isEaster) {
                return { 
                    color: '#8b5cf6', 
                    colorLight: '#ddd6fe', 
                    colorDark: '#7c3aed', 
                    status: '🎉 67 ! 🎉', 
                    rainbow: false 
                };
            }
            
            if (m < 10) return { color: '#ef4444', colorLight: '#fecaca', colorDark: '#dc2626', status: 'Insuffisant 😟', rainbow: false };
            if (m < 12) return { color: '#f97316', colorLight: '#fed7aa', colorDark: '#ea580c', status: 'Passable 😐', rainbow: false };
            if (m < 14) return { color: '#eab308', colorLight: '#fef08a', colorDark: '#ca8a04', status: 'Assez bien 🙂', rainbow: false };
            if (m < 17) return { color: '#22c55e', colorLight: '#bbf7d0', colorDark: '#16a34a', status: 'Bien 😊', rainbow: false };
            if (m < 19) return { color: '#3b82f6', colorLight: '#bfdbfe', colorDark: '#2563eb', status: 'Très bien 🎉', rainbow: false };
            return { color: '#a855f7', colorLight: '#e9d5ff', colorDark: '#7c3aed', status: 'Excellent ! 🌟✨', rainbow: true };
        }
        
        function updateColors(m, isEaster = false) {
            const c = getColorForMoyenne(m, isEaster);
            document.documentElement.style.setProperty('--accent-color', c.color);
            document.documentElement.style.setProperty('--accent-color-light', c.colorLight);
            document.documentElement.style.setProperty('--accent-color-dark', c.colorDark);
            moyenneValue.classList.toggle('rainbow-text', c.rainbow);
            moyenneCard.classList.toggle('rainbow-mode', c.rainbow);
            moyenneStatus.textContent = c.status;
        }
        
        function resetColors() {
            document.documentElement.style.setProperty('--accent-color', '#6366f1');
            document.documentElement.style.setProperty('--accent-color-light', '#e0e7ff');
            document.documentElement.style.setProperty('--accent-color-dark', '#4338ca');
            moyenneCard.classList.remove('rainbow-mode');
            moyenneValue.classList.remove('rainbow-text');
            moyenneStatus.textContent = 'Ajoutez des notes pour commencer';
            moyenneSur.textContent = '/20';
            
            if (isEasterEggActive) {
                isEasterEggActive = false;
                logoIcon.classList.remove('easter-egg');
                updateFavicon();
            }
        }
        
        const createRainbowText = (text) => text.split('').map((c, i) => 
            `<span style="color:${rainbowColors[Math.floor(i/text.length*rainbowColors.length)]}">${c}</span>`
        ).join('');
        
        // ===== NOTES =====
        const loadNotes = () => { notes = JSON.parse(localStorage.getItem('evoMoyenne_notes') || '[]'); renderNotes(); };
        const saveNotes = () => localStorage.setItem('evoMoyenne_notes', JSON.stringify(notes));
        const calculateMoyenne = () => notes.length ? notes.reduce((a, n) => a + n.sur20 * n.coef, 0) / notes.reduce((a, n) => a + n.coef, 0) : null;
        
        function addNote(value, sur, coef) {
            notes.unshift({ id: Date.now(), value: parseFloat(value), sur: parseFloat(sur), coef: parseFloat(coef), sur20: (parseFloat(value) / parseFloat(sur)) * 20 });
            saveNotes(); renderNotes();
            showToast('Note ajoutée !', 'success');
        }
        
        function deleteNote(id) {
            notes = notes.filter(n => n.id !== id);
            saveNotes(); renderNotes();
            showToast('Note supprimée', 'success');
        }
        
        function renderNotes() {
            notesCount.textContent = notes.length;
            if (!notes.length) {
                notesList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>Aucune note pour le moment.<br>Ajoutez votre première note ci-dessus !</p></div>';
                moyenneValue.textContent = '--';
                resetColors();
                return;
            }
            notesList.innerHTML = notes.map(n => `
                <div class="note-item">
                    <div class="note-value">${n.value}/${n.sur}</div>
                    <div class="note-details"><span>📊 Coef. ${n.coef}</span></div>
                    <div class="note-sur20">${n.sur20.toFixed(2)}/20</div>
                    <button class="btn-delete" onclick="deleteNote(${n.id})">✕</button>
                </div>
            `).join('');
            
            const m = calculateMoyenne();
            const isEaster = checkEasterEgg(m);
            
            if (isEaster) {
                moyenneValue.textContent = '67';
                moyenneSur.textContent = '';
            } else {
                moyenneValue.textContent = m.toFixed(2);
                moyenneSur.textContent = '/20';
            }
            
            updateColors(m, isEaster);
        }
        
        // ===== FORM =====
        noteForm.addEventListener('submit', e => {
            e.preventDefault();
            const v = document.getElementById('noteValue').value;
            const s = document.getElementById('noteSur').value;
            const c = document.getElementById('noteCoef').value;
            if (parseFloat(v) > parseFloat(s)) { showToast('Note > maximum !', 'error'); return; }
            addNote(v, s, c);
            document.getElementById('noteValue').value = '';
            document.getElementById('noteValue').focus();
        });
        
        // ===== MODAL =====
        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }
        
        document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); }));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); });
        
        // ===== BUTTONS =====
        document.getElementById('btnEcoleDirecte').addEventListener('click', () => openModal('modalEcoleDirecte'));
        document.getElementById('btnClear').addEventListener('click', () => notes.length ? openModal('modalClear') : showToast('Aucune note', 'error'));
        document.getElementById('confirmClear').addEventListener('click', () => { notes = []; saveNotes(); renderNotes(); closeModal('modalClear'); showToast('Notes supprimées', 'success'); });
        
        // ===== SHARE =====
        document.getElementById('btnShare').addEventListener('click', async () => {
            if (!notes.length) { showToast('Ajoutez des notes !', 'error'); return; }
            
            const m = calculateMoyenne();
            const isEaster = checkEasterEgg(m);
            const c = getColorForMoyenne(m, isEaster);
            const dark = getEffectiveTheme() === 'dark';
            
            const card = document.getElementById('shareCard');
            const cardM = document.getElementById('shareCardMoyenne');
            const cardS = document.getElementById('shareCardStatus');
            
            card.className = `share-card share-card-${dark ? 'dark' : 'light'}`;
            
            if (isEaster) {
                cardM.innerHTML = '67';
                cardM.style.color = c.color;
            } else if (c.rainbow) {
                cardM.innerHTML = createRainbowText(m.toFixed(2));
            } else {
                cardM.innerHTML = m.toFixed(2);
                cardM.style.color = c.color;
            }
            
            cardS.textContent = c.status;
            cardS.style.background = c.colorLight;
            cardS.style.color = c.colorDark;
            
            card.style.cssText = 'left:0;top:0;position:fixed;z-index:-1';
            
            try {
                showToast('Préparation...', 'success');
                const canvas = await html2canvas(card, { scale: 2, backgroundColor: null, logging: false });
                const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                const file = new File([blob], `evoMoyenne_${isEaster ? '67' : m.toFixed(2)}.png`, { type: 'image/png' });
                
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Ma moyenne', text: isEaster ? '67 ! 🎉' : `Ma moyenne: ${m.toFixed(2)}/20 📊` });
                    showToast('Partagé !', 'success');
                } else {
                    const a = document.createElement('a');
                    a.href = canvas.toDataURL('image/png');
                    a.download = `evoMoyenne_${isEaster ? '67' : m.toFixed(2)}.png`;
                    a.click();
                    showToast('Image téléchargée', 'success');
                }
            } catch (e) {
                if (e.name !== 'AbortError') showToast('Erreur', 'error');
            } finally {
                card.style.cssText = 'left:-9999px;top:-9999px';
            }
        });
        
        // ===== TOAST =====
        function showToast(msg, type = 'success') {
            toast.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
            toast.className = `toast toast-${type} show`;
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
        
        // ===== INIT =====
        setTheme(localStorage.getItem('evoMoyenne_theme') || 'auto');
        loadNotes();
