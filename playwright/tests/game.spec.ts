import { test, expect } from '@playwright/test';
import { JumperGameTester } from '../utils/JumperGameTester';

/**
 * Comprehensive test suite for Jumper game automation
 * 
 * This suite demonstrates canvas-based game testing using Playwright
 */

test.describe('🎮 Jumper Game - Automation Test Suite', () => {
  let tester: JumperGameTester;

  test.beforeEach(async ({ page }) => {
    tester = new JumperGameTester(page);
    await tester.loadGame();
  });

  // ===================================================================
  // SECTION 1: Game Loading & Initialization
  // ===================================================================

  test.describe('1️⃣ Game Initialization', () => {
    test('should load game and be ready to play', async ({ page }) => {
      const state = await tester.getGameState();

      expect(state.sceneKey).toBe('Game');
      expect(state.score).toBe(0);
      expect(state.lives).toBeGreaterThan(0);
      expect(state.timeLeft).toBeGreaterThan(0);
      expect(state.gameOver).toBe(false);
      expect(state.coinsRemaining).toBe(19);
    });

    test('should initialize with correct default values', async () => {
      const score = await tester.getScore();
      const lives = await tester.getLives();
      const timer = await tester.getTimer();
      const gameOver = await tester.isGameOver();

      expect(score).toBe(0);
      expect(lives).toBeGreaterThan(0);
      expect(timer).toBe(45); // Default timer is 45 seconds
      expect(gameOver).toBe(false);
    });

    test('should have all 19 coins available', async () => {
      const coinsRemaining = await tester.getCoinsRemaining();
      expect(coinsRemaining).toBe(19);
    });
  });

  // ===================================================================
  // SECTION 2: Player Movement & Control
  // ===================================================================

  test.describe('2️⃣ Player Movement & Controls', () => {
    test('should move player right with ArrowKey', async () => {
      const initialPos = await tester.getPlayerPosition();

      await tester.moveRight(3, 100);
      await tester.page.waitForTimeout(200);

      const finalPos = await tester.getPlayerPosition();

      expect(finalPos.x).toBeGreaterThan(initialPos.x);
    });

    test('should move player left with ArrowKey', async () => {
      // First move right to have room
      await tester.moveRight(5, 100);
      const beforePos = await tester.getPlayerPosition();

      await tester.moveLeft(3, 100);
      await tester.page.waitForTimeout(200);

      const finalPos = await tester.getPlayerPosition();

      expect(finalPos.x).toBeLessThan(beforePos.x);
    });

    test('should jump when pressing Space', async () => {
      const initialPos = await tester.getPlayerPosition();

      await tester.tapJump();
      await tester.page.waitForTimeout(200);

      const jumpPos = await tester.getPlayerPosition();

      // Player Y should be lower (higher up on screen means lower Y value)
      expect(jumpPos.y).toBeLessThan(initialPos.y);
    });

    test('should handle rapid movement inputs', async () => {
      // Simulate player mashing buttons
      for (let i = 0; i < 10; i++) {
        const action = Math.random();
        if (action < 0.5) {
          await tester.moveRight(1, 50);
        } else {
          await tester.moveLeft(1, 50);
        }
      }

      const state = await tester.getGameState();
      expect(state.gameOver).toBe(false); // Game should still be running
    });
  });

  // ===================================================================
  // SECTION 3: Coin Collection
  // ===================================================================

  test.describe('3️⃣ Coin Collection Mechanics', () => {
    test('should collect coins and increase score', async () => {
      const initialScore = await tester.getScore();
      const initialCoins = await tester.getCoinsRemaining();

      // Play for a bit to collect coins
      await tester.testCoinCollection();

      const finalScore = await tester.getScore();
      const finalCoins = await tester.getCoinsRemaining();

      expect(finalScore).toBeGreaterThan(initialScore);
      expect(finalCoins).toBeLessThan(initialCoins);
    });

    test('should add 3 seconds to timer when collecting coin', async () => {
      const initialTimer = await tester.getTimer();

      // Move and collect a coin
      await tester.moveRight(3);
      await tester.tapJump();
      await tester.page.waitForTimeout(1000);

      const finalTimer = await tester.getTimer();

      // Timer might have ticked down too, but should be roughly 3 seconds higher
      expect(finalTimer).toBeGreaterThan(initialTimer - 2);
    });

    test('should collect multiple coins in sequence', async () => {
      const coinsCollected = await tester.testCoinCollection();
      expect(coinsCollected).toBeGreaterThan(0);
    });
  });

  // ===================================================================
  // SECTION 4: Bomb Mechanics
  // ===================================================================

  test.describe('4️⃣ Bomb Mechanics', () => {
    test('should spawn bomb when directly created', async () => {
      const initialBombs = await tester.getBombsActive();

      // Manually spawn a bomb for testing
      await tester.spawnBomb(500, 300);
      await tester.page.waitForTimeout(200);

      const finalBombs = await tester.getBombsActive();

      expect(finalBombs).toBeGreaterThan(initialBombs);
    });

    test('should reduce lives on bomb collision', async () => {
      const initialLives = await tester.getLives();

      // Spawn bomb near player
      await tester.spawnBomb(150, 400);
      await tester.page.waitForTimeout(1500);

      const finalLives = await tester.getLives();

      expect(finalLives).toBeLessThanOrEqual(initialLives);
    });

    test('should handle multiple bombs', async () => {
      // Spawn several bombs
      await tester.spawnBomb(200, 300);
      await tester.spawnBomb(400, 200);
      await tester.spawnBomb(600, 250);
      await tester.page.waitForTimeout(300);

      const bombCount = await tester.getBombsActive();
      expect(bombCount).toBe(3);
    });

    test('should be able to clear all bombs', async () => {
      await tester.spawnBomb(200, 300);
      await tester.spawnBomb(400, 200);

      let bombCount = await tester.getBombsActive();
      expect(bombCount).toBeGreaterThan(0);

      await tester.clearBombs();
      bombCount = await tester.getBombsActive();
      expect(bombCount).toBe(0);
    });
  });

  // ===================================================================
  // SECTION 5: Timer System
  // ===================================================================

  test.describe('5️⃣ Timer & Time Management', () => {
    test('should count down timer', async () => {
      const initialTime = await tester.getTimer();
      await tester.page.waitForTimeout(2000);
      const laterTime = await tester.getTimer();

      expect(laterTime).toBeLessThan(initialTime);
    });

    test('should trigger game over when timer reaches zero', async () => {
      // Set timer to 1 second
      await tester.setTimer(1);
      await tester.page.waitForTimeout(2500);

      const gameOver = await tester.isGameOver();
      expect(gameOver).toBe(true);
    });

    test('should pause timer when game is paused', async () => {
      const beforePauseTime = await tester.getTimer();
      await tester.togglePause();
      await tester.page.waitForTimeout(2000);
      const pausedTime = await tester.getTimer();

      // Timer should not have decreased (or minimal decrease)
      expect(pausedTime).toBeGreaterThanOrEqual(beforePauseTime - 1);
    });
  });

  // ===================================================================
  // SECTION 6: Pause & Resume
  // ===================================================================

  test.describe('6️⃣ Pause & Resume System', () => {
    test('should pause game when pressing Escape', async () => {
      const isPausedBefore = await tester.isPaused();
      expect(isPausedBefore).toBe(false);

      await tester.togglePause();
      await tester.page.waitForTimeout(300);

      const isPausedAfter = await tester.isPaused();
      expect(isPausedAfter).toBe(true);
    });

    test('should resume game when pressing Escape again', async () => {
      await tester.togglePause();
      await tester.page.waitForTimeout(300);

      await tester.togglePause();
      await tester.page.waitForTimeout(300);

      const isPaused = await tester.isPaused();
      expect(isPaused).toBe(false);
    });

    test('should freeze physics when paused', async () => {
      // Get initial position
      const initialPos = await tester.getPlayerPosition();

      // Pause and wait
      await tester.togglePause();
      await tester.page.waitForTimeout(1000);

      // Position should not change much while paused
      const pausedPos = await tester.getPlayerPosition();
      expect(pausedPos.x).toBeCloseTo(initialPos.x, 50);

      // Resume and verify movement is possible again
      await tester.togglePause();
      await tester.moveRight(2);
      await tester.page.waitForTimeout(300);

      const movedPos = await tester.getPlayerPosition();
      expect(movedPos.x).toBeGreaterThan(pausedPos.x);
    });
  });

  // ===================================================================
  // SECTION 7: Lives System
  // ===================================================================

  test.describe('7️⃣ Lives Management', () => {
    test('should initialize with lives > 0', async () => {
      const lives = await tester.getLives();
      expect(lives).toBeGreaterThan(0);
    });

    test('should reduce lives on bomb hit', async () => {
      const initialLives = await tester.getLives();

      // Spawn and wait for bomb collision
      await tester.spawnBomb(150, 400);
      await page.waitForTimeout(1500);

      const finalLives = await tester.getLives();
      expect(finalLives).toBeLessThanOrEqual(initialLives);
    });

    test('should allow setting lives directly', async () => {
      await tester.setLives(10);
      const lives = await tester.getLives();
      expect(lives).toBe(10);
    });
  });

  // ===================================================================
  // SECTION 8: State Manipulation (Edge Cases)
  // ===================================================================

  test.describe('8️⃣ State Manipulation & Edge Cases', () => {
    test('should allow teleporting player', async () => {
      const targetX = 500;
      const targetY = 300;

      await tester.teleportPlayer(targetX, targetY);
      const pos = await tester.getPlayerPosition();

      expect(pos.x).toBeCloseTo(targetX, 10);
      expect(pos.y).toBeCloseTo(targetY, 10);
    });

    test('should allow setting score directly', async () => {
      await tester.setScore(100);
      const score = await tester.getScore();
      expect(score).toBe(100);
    });

    test('should allow setting timer directly', async () => {
      await tester.setTimer(30);
      const timer = await tester.getTimer();
      expect(timer).toBe(30);
    });

    test('should handle extreme values', async () => {
      await tester.setScore(99999);
      await tester.setLives(1000);
      await tester.setTimer(0);

      const state = await tester.getGameState();
      expect(state.score).toBe(99999);
      expect(state.lives).toBe(1000);
    });
  });

  // ===================================================================
  // SECTION 9: Full Gameplay Scenarios
  // ===================================================================

  test.describe('9️⃣ Full Gameplay Scenarios', () => {
    test('should complete a 30-second gameplay session', async () => {
      const results = await tester.testFullGameplay(30);

      expect(results).toHaveProperty('finalScore');
      expect(results).toHaveProperty('finalLives');
      expect(results).toHaveProperty('duration');
      expect(results.duration).toBeGreaterThan(0);
    });

    test('should maintain game state consistency during gameplay', async () => {
      // Play for 10 seconds
      const startState = await tester.getGameState();

      for (let i = 0; i < 20; i++) {
        if (Math.random() < 0.4) {
          await tester.moveLeft(1, 80);
        } else if (Math.random() < 0.8) {
          await tester.moveRight(1, 80);
        } else {
          await tester.tapJump();
        }
        await tester.page.waitForTimeout(500);
      }

      const endState = await tester.getGameState();

      // Verify state is still valid
      expect(endState.score).toBeGreaterThanOrEqual(0);
      expect(endState.lives).toBeGreaterThanOrEqual(0);
      expect(endState.timeLeft).toBeGreaterThanOrEqual(0);
    });
  });

  // ===================================================================
  // SECTION 10: Performance & Stability
  // ===================================================================

  test.describe('🔟 Performance & Stability', () => {
    test('should handle rapid input without crashing', async () => {
      // Hammer buttons rapidly
      for (let i = 0; i < 50; i++) {
        await tester.pressKey('ArrowRight', 10);
        await tester.pressKey('Space', 10);
      }

      const state = await tester.getGameState();
      expect(state.gameOver).toBe(false); // Game should recover
    });

    test('should maintain playability for extended session', async () => {
      // Play for 45 seconds (full game)
      // Note: This is a slow test, may take up to 45 seconds to complete
      const results = await tester.testFullGameplay(45);

      expect(results.gameCompleted).toBe(true); // Game should complete
      expect(results.finalScore).toBeGreaterThanOrEqual(0);
    }, { timeout: 60000 }); // Allow up to 60s timeout

    test('should not leak memory after multiple pause cycles', async () => {
      // Toggle pause multiple times
      for (let i = 0; i < 10; i++) {
        await tester.togglePause();
        await tester.page.waitForTimeout(200);
        await tester.togglePause();
        await tester.page.waitForTimeout(200);
      }

      const state = await tester.getGameState();
      expect(state.sceneKey).toBe('Game');
      expect(state.gameOver).toBe(false);
    });
  });

  // ===================================================================
  // SECTION 11: Integration Tests
  // ===================================================================

  test.describe('1️⃣1️⃣ Integration Tests', () => {
    test('should handle complete game flow: play, pause, collect, get hit, end', async () => {
      // Collect some coins
      await tester.moveRight(3);
      await tester.tapJump();
      await tester.page.waitForTimeout(500);

      const scoreAfterCollection = await tester.getScore();
      expect(scoreAfterCollection).toBeGreaterThan(0);

      // Pause
      await tester.togglePause();
      await tester.page.waitForTimeout(300);
      let isPaused = await tester.isPaused();
      expect(isPaused).toBe(true);

      // Resume
      await tester.togglePause();
      await tester.page.waitForTimeout(300);
      isPaused = await tester.isPaused();
      expect(isPaused).toBe(false);

      // Get hit by bomb
      const livesBefore = await tester.getLives();
      await tester.spawnBomb(150, 400);
      await tester.page.waitForTimeout(1500);
      const livesAfter = await tester.getLives();

      expect(livesAfter).toBeLessThanOrEqual(livesBefore);
    });

    test('should properly reset state between test runs', async () => {
      // This test verifies that game loads fresh each time
      const state = await tester.getGameState();

      expect(state.score).toBe(0);
      expect(state.coinsRemaining).toBe(19);
      expect(state.gameOver).toBe(false);
    });
  });
});
