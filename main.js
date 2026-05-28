import { Maze3D } from './src/maze.js';
import { MazeRenderer } from './src/renderer.js';
import { GameUI } from './src/ui.js';

class GameController {
  constructor() {
    this.maze = null;
    this.renderer = null;
    this.ui = null;

    // Game state
    this.player = { x: 0, y: 0, z: 0 };
    this.moves = 0;
    this.startTime = null;
    this.timerInterval = null;
    this.elapsedSeconds = 0;
    this.isGameOver = false;

    // Init components
    this.renderer = new MazeRenderer('canvas-container');
    this.ui = new GameUI(this);

    // Start initial game
    this.startNewGame();
  }

  startNewGame() {
    this.isGameOver = false;
    this.ui.hideVictoryScreen();

    // Get selected size
    const size = parseInt(this.ui.selectDifficulty.value);
    
    // Create and generate maze
    this.maze = new Maze3D(size, size, size);
    this.maze.generate();

    // Reset player position to start (0, 0, 0)
    this.player = { x: 0, y: 0, z: 0 };
    this.moves = 0;
    this.elapsedSeconds = 0;
    this.startTime = Date.now();

    // Reset timer
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);

    // Configure renderer
    this.renderer.setMaze(this.maze);
    this.renderer.setPlayerPosition(this.player.x, this.player.y, this.player.z);

    // Update UI controls
    this.ui.updateSliceSliderRange(this.ui.selectSliceMode.value);
    this.ui.triggerRendererSliceUpdate();
    this.ui.triggerRendererPathsUpdate();
    
    // Initial stats update
    this.updateStats();
  }

  resetCurrentGame() {
    if (!this.maze) return;
    this.isGameOver = false;
    this.ui.hideVictoryScreen();

    // Teleport player back to start
    this.player = { x: 0, y: 0, z: 0 };
    this.moves = 0;
    this.elapsedSeconds = 0;
    this.startTime = Date.now();

    // Reset timer
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);

    // Reset paths in renderer
    this.renderer.setPlayerPosition(this.player.x, this.player.y, this.player.z);
    
    // Clear previously explored cells except start
    this.renderer.exploredCells.clear();
    this.renderer.exploredCells.add('0,0,0');
    
    // Sync geometries and paths
    this.ui.triggerRendererSliceUpdate();
    this.renderer.updatePathLines();

    // Update stats
    this.updateStats();
  }

  movePlayer(dx, dy, dz) {
    if (this.isGameOver) return;

    // Check collision / blocking
    const blocked = this.maze.isBlocked(this.player.x, this.player.y, this.player.z, dx, dy, dz);
    if (!blocked) {
      this.player.x += dx;
      this.player.y += dy;
      this.player.z += dz;
      this.moves++;

      // Update renderer player position
      this.renderer.setPlayerPosition(this.player.x, this.player.y, this.player.z);
      
      // Update UI slice slider if auto-tracking
      const targetVal = this.ui.selectSliceMode.value === 'x' ? this.player.x :
                         (this.ui.selectSliceMode.value === 'y' ? this.player.y : this.player.z);
      this.ui.updateSliceDisplay(targetVal);

      // Check win condition
      if (
        this.player.x === this.maze.width - 1 &&
        this.player.y === this.maze.height - 1 &&
        this.player.z === this.maze.depth - 1
      ) {
        this.winGame();
      }

      this.updateStats();
    }
  }

  updateTimer() {
    if (this.isGameOver) return;
    this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.ui.hudTimer.textContent = this.getTimeString();
  }

  getTimeString() {
    const minutes = Math.floor(this.elapsedSeconds / 60);
    const seconds = this.elapsedSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  updateStats() {
    const timeStr = this.getTimeString();
    const totalCells = this.maze.width * this.maze.height * this.maze.depth;
    const exploredCount = this.renderer.exploredCells.size;

    this.ui.updateStats(
      timeStr,
      this.moves,
      this.player.x,
      this.player.y,
      this.player.z,
      totalCells,
      exploredCount
    );
  }

  winGame() {
    this.isGameOver = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const timeStr = this.getTimeString();
    this.ui.showVictoryScreen(timeStr, this.moves);
  }
}

// Start the game on page load
window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
