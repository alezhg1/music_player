// ⚙️ НАСТРОЙКИ - укажи свой GitHub username и репозиторий
const GITHUB_CONFIG = {
    username: 'alezhg1',      // ← Твой GitHub username
    repository: 'music_player',        // ← Название репозитория
    branch: 'main',                 // ← Ветка (main или master)
    musicFolder: 'music'            // ← Папка с музыкой
};

// Player state
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0 - no repeat, 1 - repeat all, 2 - repeat one
let playlist = [];

// DOM Elements
const audio = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volumeSlider');
const volumeFill = document.getElementById('volumeFill');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumCover = document.getElementById('albumCover');
const playlistToggle = document.getElementById('playlistToggle');
const playlistPanel = document.getElementById('playlistPanel');
const closePlaylist = document.getElementById('closePlaylist');
const playlistContent = document.getElementById('playlistContent');
const loadingScreen = document.getElementById('loadingScreen');
const glassPlayer = document.getElementById('glassPlayer');
const playlistCount = document.getElementById('playlistCount');

// Initialize player
async function init() {
    try {
        await loadPlaylistFromGitHub();
        
        if (playlist.length > 0) {
            loadTrack(currentTrackIndex);
            renderPlaylist();
            setupEventListeners();
            setupTouchControls();
            
            // Show player, hide loading
            loadingScreen.style.display = 'none';
            glassPlayer.style.display = 'flex';
        } else {
            showError('Не найдено MP3 файлов в папке /music/');
        }
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки: ' + error.message);
    }
}

// Загрузка списка файлов из GitHub API
async function loadPlaylistFromGitHub() {
    const { username, repository, branch, musicFolder } = GITHUB_CONFIG;
    
    // Получаем список файлов из папки music
    const apiUrl = `https://api.github.com/repos/${username}/${repository}/contents/${musicFolder}?ref=${branch}`;
    
    console.log('Запрос к GitHub API:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Папка /music/ не найдена в репозитории');
        } else if (response.status === 403) {
            throw new Error('Превышен лимит GitHub API. Попробуйте позже.');
        }
        throw new Error(`Ошибка API: ${response.status}`);
    }
    
    const files = await response.json();
    
    // Фильтруем только MP3 файлы
    const mp3Files = files
        .filter(file => file.type === 'file' && file.name.toLowerCase().endsWith('.mp3'))
        .map(file => ({
            name: file.name,
            path: file.path,
            downloadUrl: file.download_url,
            size: file.size
        }));
    
    console.log(`Найдено ${mp3Files.length} MP3 файлов`);
    
    // Загружаем метаданные для каждого файла
    for (const file of mp3Files) {
        try {
            const metadata = await readTags(file.downloadUrl);
            playlist.push({
                src: file.downloadUrl,
                path: file.path,
                title: metadata.title || getFilename(file.name),
                artist: metadata.artist || 'Неизвестный исполнитель',
                album: metadata.album || '',
                cover: metadata.picture || null,
                duration: 0
            });
        } catch (error) {
            console.error(`Ошибка чтения тегов ${file.name}:`, error);
            // Добавляем песню без метаданных
            playlist.push({
                src: file.downloadUrl,
                path: file.path,
                title: getFilename(file.name),
                artist: 'Неизвестный исполнитель',
                album: '',
                cover: null,
                duration: 0
            });
        }
    }
    
    // Сортируем по имени файла
    playlist.sort((a, b) => a.title.localeCompare(b.title));
    
    console.log('Плейлист загружен:', playlist);
}

// Чтение ID3 тегов из файла
function readTags(filePath) {
    return new Promise((resolve, reject) => {
        jsmediatags.read(filePath, {
            onSuccess: function(tag) {
                const tags = tag.tags;
                resolve({
                    title: tags.title,
                    artist: tags.artist,
                    album: tags.album,
                    picture: tags.picture || null
                });
            },
            onError: function(error) {
                reject(error);
            }
        });
    });
}

// Получение имени файла без расширения
function getFilename(filename) {
    return filename.replace(/\.[^/.]+$/, "");
}

// Преобразование base64 картинки в data URL
function getCoverDataUrl(picture) {
    if (!picture) return null;
    
    const { data, format } = picture;
    let base64String = "";
    
    for (let i = 0; i < data.length; i++) {
        base64String += String.fromCharCode(data[i]);
    }
    
    return `${format};base64,${window.btoa(base64String)}`;
}

// Load track
function loadTrack(index) {
    const track = playlist[index];
    audio.src = track.src;
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    
    // Устанавливаем обложку
    if (track.cover) {
        const coverUrl = getCoverDataUrl(track.cover);
        albumCover.innerHTML = `<img src="${coverUrl}" alt="${track.title}">`;
    } else {
        albumCover.innerHTML = `
            <div class="cover-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
            </div>
        `;
    }
    
    updatePlaylistActive();
}

// Render playlist
function renderPlaylist() {
    playlistCount.textContent = playlist.length;
    
    playlistContent.innerHTML = playlist.map((track, index) => `
        <div class="playlist-item ${index === currentTrackIndex ? 'active' : ''}" data-index="${index}">
            <div class="playlist-item-cover">
                ${track.cover 
                    ? `<img src="${getCoverDataUrl(track.cover)}" alt="${track.title}">`
                    : `<svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                       </svg>`
                }
            </div>
            <div class="playlist-item-info">
                <div class="playlist-item-title">${track.title}</div>
                <div class="playlist-item-artist">${track.artist}</div>
            </div>
            <div class="playlist-item-duration" id="duration-${index}">--:--</div>
        </div>
    `).join('');
    
    // Load durations
    playlist.forEach((track, index) => {
        const tempAudio = new Audio(track.src);
        tempAudio.addEventListener('loadedmetadata', () => {
            const durationEl = document.getElementById(`duration-${index}`);
            if (durationEl) {
                durationEl.textContent = formatTime(tempAudio.duration);
            }
            playlist[index].duration = tempAudio.duration;
        });
    });
}

// Update active playlist item
function updatePlaylistActive() {
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        item.classList.toggle('active', index === currentTrackIndex);
    });
}

// Setup event listeners
function setupEventListeners() {
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    progressBar.addEventListener('click', seek);
    volumeSlider.addEventListener('click', setVolume);
    playlistToggle.addEventListener('click', openPlaylist);
    closePlaylist.addEventListener('click', closePlaylistPanel);
    
    playlistContent.addEventListener('click', (e) => {
        const item = e.target.closest('.playlist-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            currentTrackIndex = index;
            loadTrack(index);
            play();
        }
    });
    
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleTrackEnd);
    audio.addEventListener('play', () => {
        isPlaying = true;
        updatePlayPauseButton();
        document.querySelector('.glass-player').classList.add('playing');
    });
    audio.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayPauseButton();
        document.querySelector('.glass-player').classList.remove('playing');
    });
}

// Touch controls
function setupTouchControls() {
    let isDraggingProgress = false;
    let isDraggingVolume = false;
    
    progressBar.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        seek(e);
    });
    
    document.addEventListener('touchmove', (e) => {
        if (isDraggingProgress) seek(e);
        if (isDraggingVolume) setVolume(e);
    });
    
    document.addEventListener('touchend', () => {
        isDraggingProgress = false;
        isDraggingVolume = false;
    });
    
    volumeSlider.addEventListener('touchstart', (e) => {
        isDraggingVolume = true;
        setVolume(e);
    });
}

// Play/Pause
function togglePlayPause() {
    isPlaying ? pause() : play();
}

function play() { audio.play(); }
function pause() { audio.pause(); }

// Previous/Next
function playPrevious() {
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        loadTrack(currentTrackIndex);
        play();
    }
}

function playNext() {
    if (isShuffle) {
        currentTrackIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    }
    loadTrack(currentTrackIndex);
    play();
}

// Shuffle
function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
}

// Repeat
function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('active', repeatMode > 0);
    
    if (repeatMode === 2) {
        repeatBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                <text x="12" y="14" font-size="8" text-anchor="middle" fill="currentColor">1</text>
            </svg>
        `;
    } else {
        repeatBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
        `;
    }
}

// Progress
function updateProgress() {
    const progress = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = progress + '%';
    currentTimeEl.textContent = formatTime(audio.currentTime);
}

function updateDuration() {
    durationEl.textContent = formatTime(audio.duration);
}

function seek(e) {
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pos = (clientX - rect.left) / rect.width;
    audio.currentTime = pos * audio.duration;
}

// Volume
function setVolume(e) {
    const rect = volumeSlider.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.volume = pos;
    volumeFill.style.width = (pos * 100) + '%';
}

// Track end
function handleTrackEnd() {
    if (repeatMode === 2) {
        audio.currentTime = 0;
        play();
    } else if (repeatMode === 1 || currentTrackIndex < playlist.length - 1) {
        playNext();
    }
}

// Playlist panel
function openPlaylist() { playlistPanel.classList.add('active'); }
function closePlaylistPanel() { playlistPanel.classList.remove('active'); }

// Utility
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayPauseButton() {
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}

// Error handling
function showError(message) {
    loadingScreen.innerHTML = `
        <div class="error-icon">⚠️</div>
        <p class="error-text">${message}</p>
        <button class="retry-btn" onclick="location.reload()">Попробовать снова</button>
    `;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
