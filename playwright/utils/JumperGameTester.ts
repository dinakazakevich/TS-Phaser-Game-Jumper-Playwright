import { Page, expect } from '@playwright/test';

/**
 * Utility class for automating Jumper game interactions via Playwright
 * 
 * This class provides methods to:
 * - Simulate player input (keyboard, touch)
 * - Inspect game state directly from Phaser
 * - Manipulate game state for testing edge cases
 * - Perform common test scenarios
 */
export class JumperGameTester {
  public page: Page;
  private gameLoadTimeout = 10000;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to game and wait for it to load and the Game scene to be active
   */
  async loadGame(url: string = 'http://localhost:8081'): Promise<void> { // Explicitly set default URL
    console.log('  • Navigating to game and waiting for network idle...');
    await this.page.goto(url, {
      waitUntil: 'networkidle',
      timeout: this.gameLoadTimeout,
    });
    console.log('  ✓ Page loaded');

    console.log('  • Waiting for Phaser game instance...');
    // Wait for Phaser game instance to be available on window.game
    await this.page.waitForFunction(
      () => {
        return (window as any).game !== undefined;
      },
      { timeout: this.gameLoadTimeout }
    );
    console.log('  ✓ Game instance found on window.game');

    console.log('  • Waiting for initial scenes to boot (3s delay)...');
    // Give time for initial scenes to boot up (e.g., Preloader, MainMenu)
    await this.page.waitForTimeout(3000);

    console.log('  • Stopping MainMenu scene and starting Game scene...');
    // Explicitly stop MainMenu and start Game scene
    await this.page.evaluate(async () => {
      const game = (window as any).game;
      if (game.scene.getScene('MainMenu')) {
        game.scene.stop('MainMenu');
      }
      await new Promise<void>(resolve => {
        game.scene.start('Game');
        // Small delay to ensure scene initialization
        setTimeout(resolve, 500);
      });
    });
    console.log('  ✓ Game scene initiated');

    console.log('  • Verifying Game scene is active and player exists...');
    // Wait for the Game scene to be fully active and the player object to exist
    await this.page.waitForFunction(
      () => {
        const game = (window as any).game;
        const gameScene = game?.scene?.getScene('Game');
        return gameScene && gameScene.scene && gameScene.scene.key === 'Game' && gameScene.player;
      },
      { timeout: this.gameLoadTimeout }
    );
    console.log('  ✓ Game scene is now active and ready');
  }

  // ============================================================
  // INPUT SIMULATION METHODS
  // ============================================================

  /**
   * Press a key once with optional duration
   */
  async pressKey(key: string, duration: number = 50): Promise<void> {
    await this.page.keyboard.press(key);
    if (duration > 0) {
      await this.page.waitForTimeout(duration);
    }
  }

  /**
   * Hold a key down for specified duration
   */
  async holdKey(key: string, duration: number = 500): Promise<void> {
    await this.page.keyboard.down(key);
    await this.page.waitForTimeout(duration);
    await this.page.keyboard.up(key);
  }

  /**
   * Press jump button (Space)
   */
  async tapJump(count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.pressKey('Space', 50);
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * Move player left
   */
  async moveLeft(distance: number = 1, delay: number = 100): Promise<void> {
    for (let i = 0; i < distance; i++) {
      await this.pressKey('ArrowLeft', delay);
    }
  }

  /**
   * Move player right
   */
  async moveRight(distance: number = 1, delay: number = 100): Promise<void> {
    for (let i = 0; i < distance; i++) {
      await this.pressKey('ArrowRight', delay);
    }
  }

  /**
   * Open/close pause menu via ESC key
   */
  async togglePause(): Promise<void> {
    await this.pressKey('Escape', 100);
  }

  // ============================================================
  // STATE INSPECTION METHODS
  // ============================================================

  /**
   * Get complete game state snapshot
   */
  async getGameState(): Promise<GameState> {
    const state = await this.page.evaluate(() => {
      const game = (window as any).game;
      const gameScene = game.scene.getScene('Game');

      return {
        score: gameScene.score,
        lives: gameScene.lives,
        timeLeft: gameScene.timeLeft,
        gameOver: gameScene.gameOver,
        isPaused: gameScene.isPaused,
        playerPos: {
          x: Math.round(gameScene.player.x),
          y: Math.round(gameScene.player.y),
        },
        playerVelocity: {
          x: Math.round(gameScene.player.body.velocity.x),
          y: Math.round(gameScene.player.body.velocity.y),
        },
        playerBody: {
          touching: gameScene.player.body.touching.down,
          blocked: gameScene.player.body.blocked.down,
        },
        coinsRemaining: gameScene.coins.children.entries.length,
        bombsActive: gameScene.bombs.children.entries.length,
        sceneKey: gameScene.scene.key,
        isPaused: gameScene.isPaused,
      };
    });

    return state;
  }

  /**
   * Get current score
   */
  async getScore(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').score;
    });
  }

  /**
   * Get current lives
   */
  async getLives(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').lives;
    });
  }

  /**
   * Get remaining time in seconds
   */
  async getTimer(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').timeLeft;
    });
  }

  /**
   * Check if game is over
   */
  async isGameOver(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').gameOver;
    });
  }

  /**
   * Check if game is paused
   */
  async isPaused(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').isPaused;
    });
  }

  /**
   * Get coins remaining
   */
  async getCoinsRemaining(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').coins.countActive(true);
    });
  }

  /**
   * Get active bombs count
   */
  async getBombsActive(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').bombs.countActive(true);
    });
  }

  /**
   * Get player position
   */
  async getPlayerPosition(): Promise<{ x: number; y: number }> {
    return await this.page.evaluate(() => {
      const player = (window as any).game.scene.getScene('Game').player;
      return { x: Math.round(player.x), y: Math.round(player.y) };
    });
  }

  // ============================================================
  // STATE MANIPULATION METHODS (for edge case testing)
  // ============================================================

  /**
   * Set score directly
   */
  async setScore(score: number): Promise<void> {
    await this.page.evaluate((s) => {
      (window as any).game.scene.getScene('Game').score = s;
    }, score);
  }

  /**
   * Set lives directly
   */
  async setLives(lives: number): Promise<void> {
    await this.page.evaluate((l) => {
      (window as any).game.scene.getScene('Game').lives = l;
    }, lives);
  }

  /**
   * Set timer directly
   */
  async setTimer(seconds: number): Promise<void> {
    await this.page.evaluate((t) => {
      (window as any).game.scene.getScene('Game').timeLeft = t;
    }, seconds);
  }

  /**
   * Teleport player to specific coordinates
   */
  async teleportPlayer(x: number, y: number): Promise<void> {
    await this.page.evaluate(([px, py]) => {
      (window as any).game.scene.getScene('Game').player.setPosition(px, py);
    }, [x, y]);
  }

  /**
   * Spawn a bomb at specified position
   */
  async spawnBomb(x?: number, y?: number): Promise<void> {
    await this.page.evaluate(([cx, cy]) => {
      const gameScene = (window as any).game.scene.getScene('Game');
      const bomb = gameScene.bombs.create(
        cx || gameScene.player.x + 100,
        cy || 300,
        'bomb'
      );
      bomb.setBounce(1);
      bomb.setCollideWorldBounds(true);
      bomb.setVelocity(100, -200);
    }, [x, y]);
  }

  /**
   * Remove all bombs
   */
  async clearBombs(): Promise<void> {
    await this.page.evaluate(() => {
      const gameScene = (window as any).game.scene.getScene('Game');
      gameScene.bombs.children.entries.forEach((bomb: any) => bomb.destroy());
    });
  }

  /**
   * Restore all coins
   */
  async restoreCoins(): Promise<void> {
    await this.page.evaluate(() => {
      const gameScene = (window as any).game.scene.getScene('Game');
      // Re-create coins at spawn points
      const coinSpawnPoints = gameScene.coinSpawnPoints;
      gameScene.coins.children.entries.forEach((coin: any) => coin.destroy());
      coinSpawnPoints.forEach(({ x, y }: any) => {
        const coin = gameScene.coins.create(x, y, 'coin') as any;
        coin.play('spin');
      });
    });
  }

  // ============================================================
  // WAIT/ASSERTION HELPER METHODS
  // ============================================================

  /**
   * Wait for state value to reach expected value
   */
  async waitForStateChange<T>(
    getter: () => Promise<T>,
    expectedValue: T,
    timeout: number = 5000
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const value = await getter();
      if (value === expectedValue) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error(
      `State didn't reach expected value ${expectedValue} within ${timeout}ms`
    );
  }

  /**
   * Wait for game to end
   */
  async waitForGameOver(timeout: number = 60000): Promise<void> {
    await this.waitForStateChange(() => this.isGameOver(), true, timeout);
  }

  /**
   * Wait for score to reach minimum value
   */
  async waitForScoreIncrease(minScore: number, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const score = await this.getScore();
      if (score >= minScore) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Score didn't reach ${minScore} within ${timeout}ms`);
  }

  /**
   * Wait for lives to decrease
   */
  async waitForLivesDecrease(initialLives: number, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const lives = await this.getLives();
      if (lives < initialLives) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Lives didn't decrease within ${timeout}ms`);
  }

  /**
   * Wait for timer to decrease
   */
  async waitForTimerDecrease(initialTime: number, timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const time = await this.getTimer();
      if (time < initialTime) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Timer didn't decrease within ${timeout}ms`);
  }

  // ============================================================
  // TEST SCENARIO METHODS
  // ============================================================

  /**
   * Test coin collection - move right and collect coins
   */
  async testCoinCollection(): Promise<number> {
    const initialScore = await this.getScore();
    const initialCoins = await this.getCoinsRemaining();

    // Move right to find coins
    for (let i = 0; i < 5; i++) {
      await this.moveRight(2);
      await this.tapJump();
      await this.page.waitForTimeout(200);
    }

    const finalScore = await this.getScore();
    const finalCoins = await this.getCoinsRemaining();
    const coinsCollected = initialCoins - finalCoins;

    return coinsCollected;
  }

  /**
   * Test bomb collision - spawn bomb and wait for collision
   */
  async testBombCollision(): Promise<boolean> {
    const initialLives = await this.getLives();

    // Spawn bomb near player
    await this.spawnBomb(150, 400);
    await this.page.waitForTimeout(1500);

    const finalLives = await this.getLives();
    return finalLives < initialLives;
  }

  /**
   * Test pause and resume functionality
   */
  async testPauseResume(): Promise<boolean> {
    const initialState = await this.getGameState();

    // Pause
    await this.togglePause();
    await this.page.waitForTimeout(300);
    const pausedState = await this.getGameState();
    const isPausedCorrectly = pausedState.isPaused === true;

    // Resume  
    await this.togglePause();
    await this.page.waitForTimeout(300);
    const resumedState = await this.getGameState();
    const isResumedCorrectly = resumedState.isPaused === false;

    return isPausedCorrectly && isResumedCorrectly;
  }

  /**
   * Test full gameplay session with random actions
   */
  async testFullGameplay(durationSeconds: number = 30): Promise<GameplayResults> {
    const startTime = Date.now();
    const results: GameplayResults = {
      coinsCollected: 0,
      bombHits: 0,
      finalScore: 0,
      gameCompleted: false,
      duration: 0,
      finalLives: 0,
    };

    const initialState = await this.getGameState();

    while (
      Date.now() - startTime < durationSeconds * 1000 &&
      !results.gameCompleted
    ) {
      // Random movement strategy
      const action = Math.random();
      if (action < 0.4) {
        await this.moveLeft(1, 80);
      } else if (action < 0.8) {
        await this.moveRight(1, 80);
      } else {
        await this.tapJump(1);
      }

      const state = await this.getGameState();

      if (state.gameOver) {
        results.gameCompleted = true;
      }

      await this.page.waitForTimeout(150);
    }

    const finalState = await this.getGameState();
    results.finalScore = finalState.score;
    results.finalLives = finalState.lives;
    results.duration = Math.round((Date.now() - startTime) / 1000);

    return results;
  }

  /**
   * Test timer and coin bonus system
   */
  async testTimerAndCoinBonus(): Promise<boolean> {
    const initialTimer = await this.getTimer();

    // Collect a coin
    await this.moveRight(3);
    await this.tapJump();
    await this.page.waitForTimeout(500);

    const afterCoinTimer = await this.getTimer();

    // Timer should have increased by 3 seconds (coin bonus)
    return afterCoinTimer > initialTimer;
  }
}

/**
 * Game state snapshot interface
 */
export interface GameState {
  score: number;
  lives: number;
  timeLeft: number;
  gameOver: boolean;
  isPaused: boolean;
  playerPos: { x: number; y: number };
  playerVelocity: { x: number; y: number };
  playerBody: { touching: boolean; blocked: boolean };
  coinsRemaining: number;
  bombsActive: number;
  sceneKey: string;
}

/**
 * Results from full gameplay test
 */
export interface GameplayResults {
  coinsCollected: number;
  bombHits: number;
  finalScore: number;
  gameCompleted: boolean;
  duration: number;
  finalLives: number;
}
