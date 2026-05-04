/**
 * Quick Proof of Concept Validation
 * 
 * This script validates that the game automation strategy is viable by:
 * 1. Starting the dev server
 * 2. Connecting to Playwright
 * 3. Loading the game
 * 4. Running a few quick tests
 */

import { chromium, Browser, Page } from '@playwright/test';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runQuickTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - startTime,
    });
    console.log(`✅ ${name} (${Date.now() - startTime}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: String(error),
      duration: Date.now() - startTime,
    });
    console.log(`❌ ${name} (${Date.now() - startTime}ms)`);
    console.log(`   Error: ${error}`);
  }
}

async function main() {
  console.log('\n🎮 Jumper Game Automation - Proof of Concept\n');
  console.log('━'.repeat(60));

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('\n📋 Setup Phase\n');

    // Launch browser
    console.log('  • Launching Chrome browser (headed mode)...');
    browser = await chromium.launch({
      headless: false, // Show the browser window
    });
    page = await browser.newPage();
    console.log('  ✓ Browser launched');

    // Navigate to game
    console.log('  • Loading game from http://localhost:8081...');
    try {
      await page.goto('http://localhost:8081', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      console.log('  ✓ Page loaded');
    } catch (error) {
      throw new Error(`Failed to load page. Is the dev server running? Run: npm start`);
    }

    // Wait for game to initialize
    console.log('  • Waiting for Phaser game instance...');
    await page.waitForFunction(
      () => {
        const game = (window as any).game;
        return game !== undefined;
      },
      { timeout: 30000 }
    );
    console.log('  ✓ Game instance found on window.game');

    // Wait for scenes to be ready
    console.log('  • Waiting for scenes to initialize...');
    await page.waitForTimeout(3000); // Give time for scenes to boot

    // Check which scenes are available
    const sceneInfo = await page.evaluate(() => {
      const game = (window as any).game;
      const sceneManager = game.scene;
      const scenes = sceneManager.getScenes(true);
      return scenes.map((s: any) => ({
        key: s.scene.key,
        isActive: s.isActive?.() ?? false
      }));
    });
    console.log(`  ✓ Scenes loaded: ${sceneInfo.map((s: any) => `${s.key}(${s.isActive ? 'active' : 'inactive'})`).join(', ')}`);

    // Try to start Game scene directly
    console.log('  • Starting Game scene...');
    try {
      await page.evaluate(async () => {
        const game = (window as any).game;
        // Stop any running scene and start Game
        game.scene.stop('MainMenu');
        await new Promise(resolve => {
          game.scene.start('Game');
          // Wait a bit for scene to initialize
          setTimeout(resolve, 500);
        });
      });
    } catch (e) {
      // Might fail silently if scene already active
    }
    
    // Wait for Game scene to be active
    console.log('  • Verifying Game scene...');
    await page.waitForFunction(
      () => {
        const game = (window as any).game;
        const gameScene = game?.scene?.getScene('Game');
        return gameScene && gameScene.scene && gameScene.scene.key === 'Game' && gameScene.player;
      },
      { timeout: 10000 }
    );
    console.log('  ✓ Game scene is now active and ready');

    console.log('\n🧪 Quick Validation Tests\n');
    console.log('━'.repeat(60));

    // Test 1: Game is accessible
    await runQuickTest('🔍 Game instance is accessible', async () => {
      const hasGame = await page!.evaluate(() => {
        return (window as any).game !== undefined;
      });
      if (!hasGame) throw new Error('Game not accessible');
    });

    // Test 2: Game scene exists
    await runQuickTest('🎭 Game scene is ready', async () => {
      const hasScene = await page!.evaluate(() => {
        const game = (window as any).game;
        const scene = game.scene.getScene('Game');
        return scene && scene.player && scene.scene.key === 'Game';
      });
      if (!hasScene) throw new Error('Game scene not ready');
    });

    // Test 3: Initial state is correct
    await runQuickTest('📊 Initial game state is correct', async () => {
      const state = await page!.evaluate(() => {
        const game = (window as any).game;
        const gameScene = game.scene.getScene('Game');
        return {
          score: gameScene.score,
          lives: gameScene.lives,
          timeLeft: gameScene.timeLeft,
          gameOver: gameScene.gameOver,
          coinsRemaining: gameScene.coins.children.entries.length,
        };
      });

      if (state.score !== 0) throw new Error(`Expected score 0, got ${state.score}`);
      if (state.lives <= 0) throw new Error(`Expected lives > 0, got ${state.lives}`);
      if (state.timeLeft !== 45) throw new Error(`Expected timer 45, got ${state.timeLeft}`);
      if (state.gameOver !== false) throw new Error('Game should not be over on start');
      if (state.coinsRemaining !== 19) throw new Error(`Expected 19 coins, got ${state.coinsRemaining}`);
    });

    // Test 4: Keyboard input works
    await runQuickTest('⌨️ Keyboard input affects game state', async () => {
      // Focus on canvas first
      await page!.click('canvas');
      
      const initialPos = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').player.x;
      });

      // Send keyboard events with longer hold times
      await page!.keyboard.down('ArrowRight');
      await page!.waitForTimeout(300);
      await page!.keyboard.up('ArrowRight');
      await page!.waitForTimeout(200);

      const finalPos = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').player.x;
      });

      if (finalPos <= initialPos) {
        throw new Error(`Player didn't move right. Start: ${initialPos}, End: ${finalPos}`);
      }
    });

    // Test 5: State manipulation works
    await runQuickTest('🎮 Direct state manipulation works', async () => {
      await page!.evaluate(() => {
        (window as any).game.scene.getScene('Game').score = 100;
      });

      const score = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').score;
      });

      if (score !== 100) throw new Error(`Score manipulation failed. Expected 100, got ${score}`);
    });

    // Test 6: Game continues running
    await runQuickTest('🏃 Game loop is running', async () => {
      const time1 = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').timeLeft;
      });

      await page!.waitForTimeout(1500);

      const time2 = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').timeLeft;
      });

      if (time2 >= time1) {
        throw new Error(`Timer didn't decrease. T1: ${time1}, T2: ${time2}`);
      }
    });

    // Test 7: Multiple operations in sequence
    await runQuickTest('🔄 Complex sequence of operations', async () => {
      // This combines multiple actions
      await page!.keyboard.press('Space'); // Jump
      await page!.waitForTimeout(100);
      await page!.keyboard.press('ArrowLeft');
      await page!.waitForTimeout(100);
      await page!.keyboard.press('Space'); // Jump again
      await page!.waitForTimeout(100);

      // Check game is still running
      const gameOver = await page!.evaluate(() => {
        return (window as any).game.scene.getScene('Game').gameOver;
      });

      if (gameOver) throw new Error('Game over unexpectedly');
    });

    console.log('\n' + '━'.repeat(60));
    console.log('\n📈 Results Summary\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`  Total Tests: ${results.length}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⏱️  Total Time: ${totalTime}ms\n`);

    if (failed === 0) {
      console.log('🎉 POC VALIDATION SUCCESSFUL!\n');
      console.log('✨ Canvas-based game automation is VIABLE!\n');
      console.log('Key Findings:');
      console.log('  ✅ Phaser game exposes state via window.game');
      console.log('  ✅ Keyboard input works on canvas');
      console.log('  ✅ Direct state manipulation possible');
      console.log('  ✅ Game state is inspectable and modifiable');
      console.log('  ✅ Complex sequences execute reliably\n');
    } else {
      console.log(`⚠️  ${failed} test(s) failed. See details above.\n`);
    }
  } catch (error) {
    console.error(`\n❌ Fatal Error: ${error}\n`);
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
