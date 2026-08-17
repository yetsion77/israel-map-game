import { settlements } from './data.js';
import { soundManager } from './sound.js';
import { SettlementMap } from './map.js';

class GameApp {
  constructor() {
    this.map = null;
    
    // Game State
    this.gameMode = 'identify'; // 'identify', 'north_south', 'marathon'
    this.difficulty = 'medium'; // 'easy', 'medium', 'hard'
    this.score = 0;
    this.highscores = {
      identify: parseInt(localStorage.getItem('highscore_identify')) || 0,
      north_south: parseInt(localStorage.getItem('highscore_north_south')) || 0,
      marathon: parseInt(localStorage.getItem('highscore_marathon')) || 0,
    };
    this.lives = 3;
    this.streak = 0;
    this.activeQuestion = null;
    this.timeRemaining = 60;
    this.timerInterval = null;
    this.currentNorthSouthIndex = 0;
    this.northSouthSelection = []; // User clicks order
    
    // DOM Elements
    this.screens = {};
    
    window.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    // Cache Screens
    this.screens.welcome = document.getElementById('screen-welcome');
    this.screens.playing = document.getElementById('screen-playing');
    this.screens.gameover = document.getElementById('screen-gameover');

    // Initialize Map
    this.map = new SettlementMap('map-container');

    // Setup Event Listeners
    this.setupUIEventListeners();
    this.updateHighscoresUI();
  }

  setupUIEventListeners() {
    // Mode Selection Buttons
    document.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        soundManager.playClick();
        this.gameMode = e.currentTarget.dataset.mode;
        
        // Visual toggle for selected mode
        document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Difficulty Selection Buttons
    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        soundManager.playClick();
        this.difficulty = e.currentTarget.dataset.diff;
        
        document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Start Game Button
    document.getElementById('btn-start').addEventListener('click', () => {
      soundManager.playClick();
      this.startGame();
    });

    // Game Control Buttons
    document.getElementById('btn-exit').addEventListener('click', () => {
      soundManager.playClick();
      this.endGame(true);
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      soundManager.playClick();
      this.startGame();
    });

    document.getElementById('btn-go-home').addEventListener('click', () => {
      soundManager.playClick();
      this.showScreen('welcome');
      this.map.resetView();
    });

    // Sound toggle
    const btnMute = document.getElementById('btn-mute');
    btnMute.addEventListener('click', () => {
      const isMuted = soundManager.toggleMute();
      btnMute.innerHTML = isMuted ? '<i class="icon-mute">🔇</i>' : '<i class="icon-unmute">🔊</i>';
      btnMute.classList.toggle('muted', isMuted);
    });


  }

  showScreen(screenName) {
    Object.keys(this.screens).forEach(name => {
      if (name === screenName) {
        this.screens[name].classList.remove('hidden');
      } else {
        this.screens[name].classList.add('hidden');
      }
    });

    // Handle canvas resize upon opening playing screen
    if (screenName === 'playing') {
      setTimeout(() => this.map.resize(), 100);
    }
  }

  updateHighscoresUI() {
    document.getElementById('val-hs-identify').innerText = this.highscores.identify;
    document.getElementById('val-hs-ns').innerText = this.highscores.north_south;
    document.getElementById('val-hs-marathon').innerText = this.highscores.marathon;
  }

  startGame() {
    this.score = 0;
    this.lives = this.gameMode === 'marathon' ? 1 : 3; // Marathon ends on timeout/first error
    this.streak = 0;
    this.timeRemaining = 60;
    this.currentNorthSouthIndex = 0;

    // Reset status HUD
    this.updateHUD();

    // Toggle timer for marathon mode
    if (this.gameMode === 'marathon') {
      document.getElementById('hud-lives-container').style.display = 'none';
      document.getElementById('hud-timer-container').style.display = 'flex';
      this.startTimer();
    } else {
      document.getElementById('hud-lives-container').style.display = 'flex';
      document.getElementById('hud-timer-container').style.display = 'none';
      clearInterval(this.timerInterval);
    }

    this.showScreen('playing');
    this.loadNextQuestion();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      document.getElementById('val-timer').innerText = this.timeRemaining;
      
      if (this.timeRemaining <= 10) {
        document.getElementById('hud-timer-container').classList.add('warning-pulse');
      } else {
        document.getElementById('hud-timer-container').classList.remove('warning-pulse');
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        soundManager.playError();
        this.endGame();
      }
    }, 1000);
  }

  updateHUD() {
    document.getElementById('val-score').innerText = this.score;
    document.getElementById('val-streak').innerText = this.streak;
    document.getElementById('val-timer').innerText = this.timeRemaining;
    
    // Lives icons
    const livesContainer = document.getElementById('val-lives');
    livesContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.className = i < this.lives ? 'heart active' : 'heart empty';
      heart.innerText = '❤️';
      livesContainer.appendChild(heart);
    }
  }

  // Filters settlements list based on game mode & difficulty setting
  getFilteredSettlements() {
    // Easy difficulty filters to large cities
    if (this.difficulty === 'easy') {
      return settlements.filter(s => s.type === 'city' && s.description !== undefined);
    }
    // Hard difficulty focuses on smaller kibbutzim, moshavim, and peripheral towns
    if (this.difficulty === 'hard') {
      return settlements.filter(s => s.type !== 'city' || s.description === undefined);
    }
    // Medium has everything
    return settlements;
  }

  loadNextQuestion() {
    this.map.clear();
    this.northSouthSelection = [];
    
    const container = document.getElementById('interaction-area');
    container.innerHTML = '';

    const filtered = this.getFilteredSettlements();
    if (filtered.length < 5) {
      // Fallback in case list is too small
      alert("שגיאה בסינון יישובים. נשתמש בכל היישובים.");
    }

    const pool = filtered.length >= 5 ? filtered : settlements;

    if (this.gameMode === 'identify' || this.gameMode === 'marathon') {
      this.generateIdentifyQuestion(pool, container);
    } else if (this.gameMode === 'north_south') {
      this.generateNorthSouthQuestion(pool, container);
    }
  }

  generateIdentifyQuestion(pool, container) {
    // Pick target settlement
    const target = pool[Math.floor(Math.random() * pool.length)];
    
    // Pick 3 distractors
    // To make it hard, pick from same region first
    let distractors = pool.filter(s => s.id !== target.id && s.region === target.region);
    
    // Shuffle and pick 3. If less than 3, grab from pool
    distractors.sort(() => 0.5 - Math.random());
    if (distractors.length < 3) {
      const extra = pool.filter(s => s.id !== target.id && s.region !== target.region);
      extra.sort(() => 0.5 - Math.random());
      distractors = [...distractors, ...extra].slice(0, 3);
    } else {
      distractors = distractors.slice(0, 3);
    }

    const options = [target, ...distractors].sort(() => 0.5 - Math.random());
    this.activeQuestion = { target, options };

    // Setup map
    this.map.addMarker(target.lat, target.lon, { color: '#ff0055', pulse: true });
    this.map.focusOnCoordinates([target]);

    // Build buttons UI
    const prompt = document.createElement('h2');
    prompt.className = 'game-prompt';
    prompt.innerText = 'איזה יישוב ממוקם בנקודה המסומנת?';
    container.appendChild(prompt);

    const grid = document.createElement('div');
    grid.className = 'options-grid';

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn-option';
      btn.innerText = opt.name;
      btn.addEventListener('click', () => this.handleIdentifyAnswer(opt));
      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  handleIdentifyAnswer(selectedOption) {
    const target = this.activeQuestion.target;
    const isCorrect = selectedOption.id === target.id;

    // Disable all options
    document.querySelectorAll('.btn-option').forEach(btn => {
      btn.disabled = true;
      if (btn.innerText === target.name) {
        btn.classList.add('correct');
      } else if (btn.innerText === selectedOption.name && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    // Clear previous map markers and draw detailed answer review
    this.map.clear();

    if (isCorrect) {
      soundManager.playSuccess();
      this.score += this.gameMode === 'marathon' ? 15 : 10;
      this.streak++;
      if (this.gameMode === 'marathon') {
        this.timeRemaining += 4; // Add time bonus
      }

      // Draw green glowing success node
      this.map.addMarker(target.lat, target.lon, { color: '#22c55e', label: target.name, size: 10 });
      this.map.focusOnCoordinates([target]);
    } else {
      soundManager.playError();
      this.streak = 0;
      if (this.gameMode !== 'marathon') {
        this.lives--;
      } else {
        this.timeRemaining = Math.max(0, this.timeRemaining - 8); // Time penalty in marathon
      }

      // Draw both points and a dashed line connecting them to teach the user
      this.map.addMarker(target.lat, target.lon, { color: '#22c55e', label: target.name, size: 10 });
      this.map.addMarker(selectedOption.lat, selectedOption.lon, { color: '#ef4444', label: selectedOption.name, size: 8 });
      this.map.addConnection(selectedOption, target, 'rgba(239, 68, 68, 0.6)');
      
      // Focus map to fit both markers so they can see the comparison
      this.map.focusOnCoordinates([selectedOption, target]);
    }

    this.updateHUD();

    if (this.lives <= 0) {
      setTimeout(() => this.endGame(), 1800);
    } else {
      setTimeout(() => this.loadNextQuestion(), 2000);
    }
  }

  generateNorthSouthQuestion(pool, container) {
    // Mode asks to arrange 2 or 3 settlements from North to South
    // Easy: 2 settlements. Medium/Hard: 3 settlements.
    const numSettlements = (this.difficulty === 'easy') ? 2 : 3;

    // Pick random settlements from different latitudes to avoid confusion
    let selected = [];
    let attempts = 0;
    
    while (selected.length < numSettlements && attempts < 100) {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      
      // Ensure it is not too close in latitude to already selected ones (at least 0.1 deg diff)
      const tooClose = selected.some(s => Math.abs(s.lat - candidate.lat) < 0.1);
      
      if (!tooClose && !selected.some(s => s.id === candidate.id)) {
        selected.push(candidate);
      }
      attempts++;
    }

    // Fallback if failed to find distinct latitudes
    if (selected.length < numSettlements) {
      selected = [];
      while (selected.length < numSettlements) {
        const candidate = pool[Math.floor(Math.random() * pool.length)];
        if (!selected.some(s => s.id === candidate.id)) {
          selected.push(candidate);
        }
      }
    }

    // Sort correct answer: Highest Latitude (North) to Lowest Latitude (South)
    const sortedCorrect = [...selected].sort((a, b) => b.lat - a.lat);
    this.activeQuestion = { list: selected, correctOrder: sortedCorrect };

    // Set markers on map (generic glowing white markers, labeled A, B, C or no labels for guessing)
    const labels = ['א', 'ב', 'ג'];
    selected.forEach((s, idx) => {
      this.map.addMarker(s.lat, s.lon, { color: '#ffffff', label: `?`, size: 8 });
    });
    this.map.focusOnCoordinates(selected);

    // Prompt UI
    const prompt = document.createElement('h2');
    prompt.className = 'game-prompt';
    prompt.innerText = `סדרו את היישובים מצפון לדרום (לחצו לפי הסדר מהכי צפוני להכי דרומי):`;
    container.appendChild(prompt);

    // List of option buttons to click in order
    const listDiv = document.createElement('div');
    listDiv.className = 'ns-options-container';

    // Shuffle options so they aren't pre-sorted
    const shuffledOptions = [...selected].sort(() => 0.5 - Math.random());

    shuffledOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'btn-ns-option';
      btn.innerText = opt.name;
      
      btn.addEventListener('click', (e) => {
        if (btn.classList.contains('selected')) return;
        soundManager.playClick();
        
        // Select
        this.northSouthSelection.push(opt);
        btn.classList.add('selected');
        
        // Display selection bubble
        const badge = document.createElement('span');
        badge.className = 'selection-badge';
        badge.innerText = this.northSouthSelection.length;
        btn.appendChild(badge);

        // Check if finished selection
        if (this.northSouthSelection.length === numSettlements) {
          this.handleNorthSouthAnswer();
        }
      });
      listDiv.appendChild(btn);
    });

    container.appendChild(listDiv);
  }

  handleNorthSouthAnswer() {
    const correctOrder = this.activeQuestion.correctOrder;
    const userOrder = this.northSouthSelection;
    
    let isCorrect = true;
    for (let i = 0; i < correctOrder.length; i++) {
      if (correctOrder[i].id !== userOrder[i].id) {
        isCorrect = false;
        break;
      }
    }

    // Disable buttons
    document.querySelectorAll('.btn-ns-option').forEach(btn => {
      btn.disabled = true;
    });

    this.map.clear();

    if (isCorrect) {
      soundManager.playSuccess();
      this.score += this.gameMode === 'marathon' ? 25 : 20;
      this.streak++;

      // Render correct ordered path in green
      correctOrder.forEach((s, idx) => {
        this.map.addMarker(s.lat, s.lon, { color: '#22c55e', label: `${idx + 1}. ${s.name}`, size: 10 });
        if (idx > 0) {
          this.map.addConnection(correctOrder[idx - 1], s, 'rgba(34, 197, 94, 0.7)');
        }
      });
    } else {
      soundManager.playError();
      this.streak = 0;
      if (this.gameMode !== 'marathon') {
        this.lives--;
      }

      // Show correct path in green/yellow dotted lines, and label their correct sequence
      correctOrder.forEach((s, idx) => {
        this.map.addMarker(s.lat, s.lon, { color: '#eab308', label: `${idx + 1} (צפון->דרום): ${s.name}`, size: 10 });
        if (idx > 0) {
          this.map.addConnection(correctOrder[idx - 1], s, 'rgba(234, 179, 8, 0.7)');
        }
      });

      // Highlight wrong ordering in the HTML list
      document.querySelectorAll('.btn-ns-option').forEach(btn => {
        btn.classList.add('reveal-wrong');
      });
    }

    this.updateHUD();

    if (this.lives <= 0) {
      setTimeout(() => this.endGame(), 2200);
    } else {
      setTimeout(() => this.loadNextQuestion(), 2400);
    }
  }

  endGame(isManualExit = false) {
    clearInterval(this.timerInterval);
    
    if (isManualExit) {
      this.showScreen('welcome');
      this.map.resetView();
      return;
    }

    // Check highscore
    let isNewHighscore = false;
    const currentMode = this.gameMode;
    if (this.score > this.highscores[currentMode]) {
      this.highscores[currentMode] = this.score;
      localStorage.setItem(`highscore_${currentMode}`, this.score);
      isNewHighscore = true;
      this.updateHighscoresUI();
      soundManager.playLevelUp();
    }

    // Setup Gameover Screen
    document.getElementById('lbl-final-score').innerText = this.score;
    
    const modeHebrew = {
      identify: 'זהו את היישוב',
      north_south: 'מצפון לדרום',
      marathon: 'מרתון זמן'
    }[currentMode];
    
    document.getElementById('lbl-game-mode').innerText = `${modeHebrew} (${this.difficulty})`;
    
    const hsContainer = document.getElementById('new-hs-message');
    if (isNewHighscore) {
      hsContainer.innerHTML = '🎉 שיא אישי חדש! כל הכבוד! 🎉';
      hsContainer.className = 'hs-glow';
    } else {
      hsContainer.innerHTML = `השיא האישי שלך במצב זה: <strong>${this.highscores[currentMode]}</strong>`;
      hsContainer.className = '';
    }

    this.showScreen('gameover');
  }
}

// Start application
new GameApp();
