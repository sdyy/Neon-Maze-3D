export class GameUI {
  constructor(game) {
    this.game = game;
    this.lastMoveTime = 0;
    this.moveCooldown = 130; // Cooldown in ms to prevent runaway moves

    // DOM Elements
    this.btnNewGame = document.getElementById('btn-new');
    this.btnResetGame = document.getElementById('btn-reset');
    this.selectDifficulty = document.getElementById('select-difficulty');
    
    this.selectSliceMode = document.getElementById('select-slice');
    this.sliderSliceVal = document.getElementById('slider-slice-val');
    this.spanSliceVal = document.getElementById('span-slice-val');
    this.cbAutoSlice = document.getElementById('cb-auto-slice');
    
    this.sliderXRay = document.getElementById('slider-xray');
    this.spanXRay = document.getElementById('span-xray');
    
    this.cbShowHint = document.getElementById('cb-show-hint');
    this.cbShowExplored = document.getElementById('cb-show-explored');

    // Stats
    this.hudTimer = document.getElementById('hud-timer');
    this.hudMoves = document.getElementById('hud-moves');
    this.hudPos = document.getElementById('hud-pos');
    this.hudDistance = document.getElementById('hud-distance');
    this.hudProgress = document.getElementById('hud-progress');

    // Overlay screen
    this.victoryOverlay = document.getElementById('victory-overlay');
    this.btnVictoryNext = document.getElementById('btn-victory-next');
    this.victoryStats = document.getElementById('victory-stats');

    this.setupListeners();
  }

  setupListeners() {
    // 1. Game Controls
    this.btnNewGame.addEventListener('click', () => this.game.startNewGame());
    this.btnResetGame.addEventListener('click', () => this.game.resetCurrentGame());
    
    this.selectDifficulty.addEventListener('change', () => {
      this.game.startNewGame();
    });

    // 2. Slicing Controls
    this.selectSliceMode.addEventListener('change', (e) => {
      const mode = e.target.value;
      this.updateSliceSliderRange(mode);
      this.triggerRendererSliceUpdate();
    });

    this.sliderSliceVal.addEventListener('input', (e) => {
      this.spanSliceVal.textContent = e.target.value;
      this.triggerRendererSliceUpdate();
    });

    this.cbAutoSlice.addEventListener('change', (e) => {
      const auto = e.target.checked;
      this.sliderSliceVal.disabled = auto;
      this.triggerRendererSliceUpdate();
    });

    // 3. X-Ray Opacity Control
    this.sliderXRay.addEventListener('input', (e) => {
      const opacity = parseFloat(e.target.value);
      this.spanXRay.textContent = Math.round(opacity * 100) + '%';
      this.triggerRendererSliceUpdate();
    });

    // 4. Paths visibility
    this.cbShowHint.addEventListener('change', () => this.triggerRendererPathsUpdate());
    this.cbShowExplored.addEventListener('change', () => this.triggerRendererPathsUpdate());

    // 5. Victory Next Button
    this.btnVictoryNext.addEventListener('click', () => {
      this.hideVictoryScreen();
      this.game.startNewGame();
    });

    // 6. Keyboard navigation
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  updateSliceSliderRange(mode) {
    if (!this.game.maze) return;
    
    if (mode === 'none') {
      this.sliderSliceVal.disabled = true;
      this.sliderSliceVal.min = 0;
      this.sliderSliceVal.max = 0;
      this.sliderSliceVal.value = 0;
      this.spanSliceVal.textContent = '-';
    } else {
      let maxVal = 0;
      if (mode === 'x') maxVal = this.game.maze.width - 1;
      else if (mode === 'y') maxVal = this.game.maze.height - 1;
      else if (mode === 'z') maxVal = this.game.maze.depth - 1;

      this.sliderSliceVal.min = 0;
      this.sliderSliceVal.max = maxVal;
      
      // Keep value in range
      if (parseInt(this.sliderSliceVal.value) > maxVal) {
        this.sliderSliceVal.value = 0;
      }
      
      this.sliderSliceVal.disabled = this.cbAutoSlice.checked;
      this.spanSliceVal.textContent = this.sliderSliceVal.value;
    }
  }

  triggerRendererSliceUpdate() {
    const mode = this.selectSliceMode.value;
    const val = parseInt(this.sliderSliceVal.value);
    const auto = this.cbAutoSlice.checked;
    const xray = parseFloat(this.sliderXRay.value);
    
    this.game.renderer.updateSliceSettings(mode, val, auto, xray);
  }

  triggerRendererPathsUpdate() {
    const hint = this.cbShowHint.checked;
    const explored = this.cbShowExplored.checked;
    this.game.renderer.updateShowPaths(hint, explored);
  }
  handleKeyDown(e) {
    if (this.game.isGameOver) return;

    // Prevent scrolling for navigation keys
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown'];
    if (navKeys.includes(e.key)) {
      e.preventDefault();
    }

    const now = Date.now();
    if (now - this.lastMoveTime < this.moveCooldown) return;

    let dx = 0;
    let dy = 0;
    let dz = 0;

    // Get camera-relative directions from renderer
    const relativeDirs = this.game.renderer.getMovementDirections();

    switch (e.key.toLowerCase()) {
      // Horizontal movement relative to FPV camera facing direction
      case 'arrowup':
      case 'w':
        dx = relativeDirs.forward.dx;
        dy = relativeDirs.forward.dy;
        dz = relativeDirs.forward.dz;
        break;
      case 'arrowdown':
      case 's':
        dx = relativeDirs.backward.dx;
        dy = relativeDirs.backward.dy;
        dz = relativeDirs.backward.dz;
        break;
      case 'arrowleft':
      case 'a':
        dx = relativeDirs.left.dx;
        dy = relativeDirs.left.dy;
        dz = relativeDirs.left.dz;
        break;
      case 'arrowright':
      case 'd':
        dx = relativeDirs.right.dx;
        dy = relativeDirs.right.dy;
        dz = relativeDirs.right.dz;
        break;

      // Vertical (Y)
      case ' ': // Space key
      case 'q':
      case 'pageup':
        dy = 1; // Up
        break;
      case 'shift':
      case 'e':
      case 'pagedown':
        dy = -1; // Down
        break;

      default:
        return; // Ignore other keys
    }

    this.lastMoveTime = now;
    this.game.movePlayer(dx, dy, dz);
  }


  // Update visual controls after a player move or slice jump
  updateSliceDisplay(val) {
    if (this.cbAutoSlice.checked && this.selectSliceMode.value !== 'none') {
      this.sliderSliceVal.value = val;
      this.spanSliceVal.textContent = val;
    }
  }

  updateStats(timeString, moves, px, py, pz, totalCells, exploredCount) {
    // 1. Timer
    this.hudTimer.textContent = timeString;
    
    // 2. Moves
    this.hudMoves.textContent = moves;
    
    // 3. Position
    this.hudPos.textContent = `[${px}, ${py}, ${pz}]`;
    
    // 4. Progress (Percentage of cells explored)
    const pct = Math.round((exploredCount / totalCells) * 100);
    this.hudProgress.textContent = `${pct}%`;

    // 5. Remaining Path Distance to Exit (computed by A*)
    const exitPos = { 
      x: this.game.maze.width - 1, 
      y: this.game.maze.height - 1, 
      z: this.game.maze.depth - 1 
    };
    const path = this.game.maze.solve({ x: px, y: py, z: pz }, exitPos);
    this.hudDistance.textContent = path.length > 0 ? path.length - 1 : '-';
  }

  showVictoryScreen(timeString, moves) {
    this.victoryStats.innerHTML = `
      <div>時間: <span class="highlight">${timeString}</span></div>
      <div>步數: <span class="highlight">${moves}</span></div>
      <div>難度: <span class="highlight">${this.selectDifficulty.options[this.selectDifficulty.selectedIndex].text}</span></div>
    `;
    this.victoryOverlay.classList.add('active');
  }

  hideVictoryScreen() {
    this.victoryOverlay.classList.remove('active');
  }
}
