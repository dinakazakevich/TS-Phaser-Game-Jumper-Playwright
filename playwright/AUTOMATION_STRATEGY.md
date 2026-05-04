# Automation Strategy for Canvas-Based Game Testing

## The Challenge: Canvas vs. DOM

Phaser games (like Jumper) render to **canvas**, not HTML DOM elements. This means:

- ❌ No clickable buttons to automate
- ❌ No text fields to interact with
- ❌ Traditional Selenium/Playwright element selectors won't work
- ✅ Can simulate keyboard/mouse input to the canvas
- ✅ Can access game state directly via JavaScript
- ✅ Can manipulate physics directly through Phaser API

---

## Automation Approaches

### **Approach 1: Keyboard/Mouse Input Simulation (Most Common)**

**How it works:**
- Simulate keyboard events (press Arrow Keys, WASD, Space, ESC)
- Simulate mouse/touch events on the canvas element
- Phaser's input system captures these synthetic events
- Game responds as if a real player provided input

**Pros:**
- Tests real input handling pipeline
- Validates keyboard event bindings
- Tests from player perspective

**Cons:**
- Only tests what's exposed to player input
- Can't manipulate state directly
- Timing-dependent (race conditions)

**Example with Playwright:**

```typescript
// Send keyboard input
await page.press('canvas', 'ArrowRight');  // Move right
await page.press('canvas', 'Space');        // Jump
await page.press('canvas', 'Escape');       // Pause menu

// Send multiple inputs rapidly
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('Space');
```

---

### **Approach 2: Direct Game State Access (Most Powerful)**

**How it works:**
- Access Phaser game instance in browser memory
- Manipulate physics, sprites, scores directly
- Inspect game state without simulating input
- Teleport player, spawn bombs, modify score programmatically

**Pros:**
- Tests game logic independent of input systems
- Can test edge cases hard to reach manually
- Deterministic (no timing issues)
- Fast (no animation delays)

**Cons:**
- Doesn't test actual player controls
- Requires knowledge of codebase internals
- Brittle if code structure changes

**Example with Playwright:**

```typescript
// Access Phaser game instance (exposed globally)
const gameState = await page.evaluate(() => {
  const game = (window as any).game; // Phaser game singleton
  return {
    score: game.scene.getScene('Game').score,
    lives: game.scene.getScene('Game').lives,
    timeLeft: game.scene.getScene('Game').timeLeft,
    playerPosition: {
      x: game.scene.getScene('Game').player.x,
      y: game.scene.getScene('Game').player.y
    }
  };
});

// Manipulate game state directly
await page.evaluate(() => {
  const gameScene = (window as any).game.scene.getScene('Game');
  gameScene.score += 10;  // Add score
  gameScene.lives = 5;    // Set lives
  gameScene.timeLeft = 30; // Adjust timer
});

// Teleport player
await page.evaluate(() => {
  const gameScene = (window as any).game.scene.getScene('Game');
  gameScene.player.setPosition(500, 300);
});

// Trigger collision manually
await page.evaluate(() => {
  const gameScene = (window as any).game.scene.getScene('Game');
  gameScene.handleBombPlayerCollision(gameScene.player, bombSprite);
});
```

---

### **Approach 3: Hybrid Approach (Recommended)**

**Combine both methods:**
1. Use keyboard simulation for normal gameplay testing
2. Use direct state access for edge cases and debugging
3. Use state inspection to verify outcomes

**Example workflow:**

```typescript
// Simulate player collecting coins
await page.press('canvas', 'ArrowRight');
await page.press('canvas', 'ArrowRight');
await page.press('canvas', 'Space');

// Verify score increased (check game state directly)
const score = await page.evaluate(() => {
  return (window as any).game.scene.getScene('Game').score;
});
console.log('Score after coin:', score); // Should be > 0

// Test bomb edge case by spawning one directly
await page.evaluate(() => {
  const gameScene = (window as any).game.scene.getScene('Game');
  const bomb = gameScene.bombs.create(500, 300, 'bomb');
  bomb.setBounce(1);
});

// Now simulate collision via keyboard to dodge it
await page.press('canvas', 'ArrowLeft');
```

---

## Testing Tools & Frameworks

### **1. Playwright (Browser Automation)**

**Best for:** Full game session testing, multi-browser support  
**What it does:**
- Automates browser actions (keyboard, mouse, screenshots)
- Runs in Chrome, Firefox, Safari
- Can run headless (no GUI)
- Excellent for CI/CD pipelines

```typescript
import { test, expect } from '@playwright/test';

test('collect coin and verify score', async ({ page }) => {
  await page.goto('http://localhost:8081');
  
  // Wait for game to load
  await page.waitForFunction(() => {
    return (window as any).game?.scene?.getScene('Game');
  });
  
  // Move to coin position
  await page.press('canvas', 'ArrowRight');
  await page.press('canvas', 'ArrowRight');
  
  // Verify score
  const score = await page.evaluate(() => {
    return (window as any).game.scene.getScene('Game').score;
  });
  
  expect(score).toBeGreaterThan(0);
});
```

**Install:**
```bash
npm install --save-dev @playwright/test
```

---

### **2. Cypress (Interactive Testing)**

**Best for:** Development-time testing, visual debugging  
**What it does:**
- Browser automation with real-time replay
- Excellent for debugging (can see what happened)
- Good TypeScript support
- Great for E2E testing

```typescript
describe('Jumper Game Tests', () => {
  beforeEach(() => {
    cy.visit('http://localhost:8081');
    cy.window().then(win => {
      cy.wrap(win.game).as('phaserGame');
    });
  });

  it('should increase score when collecting coins', () => {
    cy.get('canvas').type('{arrowright}{arrowright}{space}');
    
    cy.window().then(win => {
      const score = win.game.scene.getScene('Game').score;
      expect(score).to.be.greaterThan(0);
    });
  });
});
```

---

### **3. Jest + Puppeteer (Unit & Integration Testing)**

**Best for:** Headless testing, performance metrics  
**What it does:**
- Fast nodeJS-based testing
- Headless Chrome/Chromium only
- Can collect performance metrics
- Good for CI/CD

```typescript
describe('Jumper Game', () => {
  let page: Page;
  
  beforeAll(async () => {
    page = await browser.newPage();
    await page.goto('http://localhost:8081');
  });

  test('player can jump', async () => {
    await page.keyboard.press('Space');
    
    const playerY = await page.evaluate(() => {
      return (window as any).game.scene.getScene('Game').player.y;
    });
    
    expect(playerY).toBeLessThan(600); // Should be higher up after jump
  });
});
```

---

### **4. Direct Phaser Testing (No Browser)**

**Best for:** Pure game logic testing (no rendering)  
**What it does:**
- Test Phaser logic without opening browser
- Very fast (pure Node.js)
- Test physics, collision, scoring separately

```typescript
// In Jest test file
import * as Phaser from 'phaser';

describe('Coin Collection Logic', () => {
  test('should add score when coin collected', () => {
    // Create minimal Phaser scene for testing
    const scene = new Game();
    scene.sys.init({
      // Mock config
    });
    
    // Manually call collision handler
    scene.handleCoinPickup(player, coin);
    
    expect(scene.score).toBe(1);
  });
});
```

---

## Practical Implementation: AI Game Tester

Here's how to build an autonomous tester combining these approaches:

### **Architecture:**

```
┌─────────────────────────────────────────┐
│     AI Game Testing System              │
├─────────────────────────────────────────┤
│  Test Orchestrator                      │
│  ├─ Scene Manager                       │
│  ├─ Input Simulator                     │
│  ├─ State Inspector                     │
│  └─ Report Generator                    │
├─────────────────────────────────────────┤
│  Playwright (Browser Automation)        │
├─────────────────────────────────────────┤
│  Phaser Game (Canvas Rendering)         │
└─────────────────────────────────────────┘
```

### **Example Test Framework:**

```typescript
// game-tester.spec.ts
import { test, expect } from '@playwright/test';

class JumperGameTester {
  private page: any;
  
  async setup(url: string = 'http://localhost:8081') {
    // Launch browser and navigate
    // Implementation details...
  }
  
  // Input Simulation
  async pressKey(key: string, duration: number = 100) {
    await this.page.press('canvas', key);
    await this.page.waitForTimeout(duration);
  }
  
  async holdKey(key: string, duration: number = 500) {
    await this.page.keyboard.down(key);
    await this.page.waitForTimeout(duration);
    await this.page.keyboard.up(key);
  }
  
  async tapJump() {
    await this.pressKey('Space', 50);
  }
  
  async moveLeft(distance: number = 1) {
    for (let i = 0; i < distance; i++) {
      await this.pressKey('ArrowLeft', 100);
    }
  }
  
  async moveRight(distance: number = 1) {
    for (let i = 0; i < distance; i++) {
      await this.pressKey('ArrowRight', 100);
    }
  }
  
  // State Inspection
  async getGameState() {
    return await this.page.evaluate(() => {
      const game = (window as any).game;
      const gameScene = game.scene.getScene('Game');
      
      return {
        score: gameScene.score,
        lives: gameScene.lives,
        timeLeft: gameScene.timeLeft,
        playerPos: { x: gameScene.player.x, y: gameScene.player.y },
        playerVelocity: { x: gameScene.player.body.velocity.x, y: gameScene.player.body.velocity.y },
        gameOver: gameScene.gameOver,
        isPaused: gameScene.isPaused,
        coinCount: gameScene.coins.children.size,
        bombCount: gameScene.bombs.children.size,
      };
    });
  }
  
  async getScore(): Promise<number> {
    const state = await this.getGameState();
    return state.score;
  }
  
  async getLives(): Promise<number> {
    const state = await this.getGameState();
    return state.lives;
  }
  
  async getTimer(): Promise<number> {
    const state = await this.getGameState();
    return state.timeLeft;
  }
  
  async isGameOver(): Promise<boolean> {
    const state = await this.getGameState();
    return state.gameOver;
  }
  
  async isPaused(): Promise<boolean> {
    const state = await this.getGameState();
    return state.isPaused;
  }
  
  async waitForStateChange<T>(
    getter: () => Promise<T>,
    expectedValue: T,
    timeout: number = 5000
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const value = await getter();
      if (value === expectedValue) return true;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`State didn't reach expected value within ${timeout}ms`);
  }
  
  // Direct State Manipulation (for edge cases)
  async setScore(score: number) {
    await this.page.evaluate((s) => {
      (window as any).game.scene.getScene('Game').score = s;
    }, score);
  }
  
  async setLives(lives: number) {
    await this.page.evaluate((l) => {
      (window as any).game.scene.getScene('Game').lives = l;
    }, lives);
  }
  
  async setTimer(seconds: number) {
    await this.page.evaluate((t) => {
      (window as any).game.scene.getScene('Game').timeLeft = t;
    }, seconds);
  }
  
  async spawnBomb(x?: number, y?: number) {
    await this.page.evaluate(([cx, cy]) => {
      const gameScene = (window as any).game.scene.getScene('Game');
      const bomb = gameScene.bombs.create(
        cx || gameScene.player.x + 100,
        cy || 300,
        'bomb'
      );
      bomb.setBounce(1);
      bomb.setCollideWorldBounds(true);
    }, [x, y]);
  }
  
  async teleportPlayer(x: number, y: number) {
    await this.page.evaluate(([px, py]) => {
      (window as any).game.scene.getScene('Game').player.setPosition(px, py);
    }, [x, y]);
  }
  
  // Test Scenarios
  async testCoinCollection() {
    const initialScore = await this.getScore();
    
    // Move to first coin
    await this.moveRight(3);
    await this.tapJump();
    
    // Wait for score to increase
    await this.waitForStateChange(
      () => this.getScore(),
      initialScore + 1
    );
    
    const finalScore = await this.getScore();
    expect(finalScore).toBe(initialScore + 1);
  }
  
  async testBombCollision() {
    const initialLives = await this.getLives();
    
    // Spawn bomb near player
    await this.spawnBomb(100, 400);
    
    // Wait for collision
    await this.page.waitForTimeout(1000);
    
    const finalLives = await this.getLives();
    expect(finalLives).toBe(initialLives - 1);
  }
  
  async testPauseResume() {
    const stateBeforePause = await this.getGameState();
    
    await this.pressKey('Escape'); // Open pause menu
    await this.page.waitForTimeout(500);
    
    let isPaused = await this.isPaused();
    expect(isPaused).toBe(true);
    
    await this.pressKey('Escape'); // Close pause menu
    await this.page.waitForTimeout(500);
    
    isPaused = await this.isPaused();
    expect(isPaused).toBe(false);
  }
  
  async testFullGameplay(durationSeconds: number = 30) {
    const startTime = Date.now();
    const results = {
      coinsCollected: 0,
      bombHits: 0,
      finalScore: 0,
      gameCompleted: false,
    };
    
    while (Date.now() - startTime < durationSeconds * 1000) {
      // Random movement
      const action = Math.random();
      if (action < 0.4) {
        await this.moveLeft(1);
      } else if (action < 0.8) {
        await this.moveRight(1);
      } else {
        await this.tapJump();
      }
      
      const state = await this.getGameState();
      
      if (state.gameOver) {
        results.gameCompleted = true;
        results.finalScore = state.score;
        break;
      }
      
      await this.page.waitForTimeout(200);
    }
    
    return results;
  }
}

// Usage in tests
test('collect coin and increase score', async ({ page: pPage }) => {
  const tester = new JumperGameTester();
  (tester as any).page = pPage;
  
  await tester.setup();
  await tester.testCoinCollection();
});

test('bomb collision reduces lives', async ({ page: pPage }) => {
  const tester = new JumperGameTester();
  (tester as any).page = pPage;
  
  await tester.setup();
  await tester.testBombCollision();
});

test('full gameplay session', async ({ page: pPage }) => {
  const tester = new JumperGameTester();
  (tester as any).page = pPage;
  
  await tester.setup();
  const results = await tester.testFullGameplay(45);
  
  expect(results.finalScore).toBeGreaterThanOrEqual(0);
});
```

---

## Integration with CI/CD

### **GitHub Actions Workflow Example:**

```yaml
name: Game Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start dev server
        run: npm start &
        
      - name: Wait for server
        run: npx wait-on http://localhost:8081
      
      - name: Run game tests
        run: npx playwright test
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Comparison Table

| Method | Speed | Reliability | Setup | Best For |
|--------|-------|-------------|-------|----------|
| **Keyboard Simulation** | Medium | High | Easy | Full gameplay testing |
| **State Inspection** | Fast | High | Medium | Verification, edge cases |
| **Direct Manipulation** | Fast | Medium | Medium | Unit testing, edge cases |
| **Headless Playwright** | Medium | Very High | Medium | CI/CD pipelines |
| **Cypress** | Medium | High | Easy | Dev-time debugging |
| **Pure Jest** | Very Fast | Medium | Hard | Logic testing only |

---

## Key Insights for Phaser Testing

1. **Keyboard events work on canvas** - The canvas element can receive keyboard input
2. **Phaser exposes game globally** - Access via `window.game` in browser console
3. **Physics can be inspected** - Check velocity, position, collision data
4. **Scenes are accessible** - Get any scene via `game.scene.getScene('SceneName')`
5. **State mutation for testing** - Directly modify game state for edge case testing
6. **No DOM, no selectors** - Can't use traditional element selectors
7. **Timing matters** - Use `waitFor` patterns, not `setTimeout`
8. **Headless browsers work great** - Playwright + headless Chrome is production-ready

---

## Recommended Setup for Jumper

### **For Your Project:**

1. **Install Playwright:**
   ```bash
   npm install --save-dev @playwright/test
   ```

2. **Create test file:**
   ```
   playwright/tests/game.spec.ts
   ```

3. **Configure Playwright:**
   ```bash
   npx playwright install
   ```

4. **Add to package.json:**
   ```json
   {
     "scripts": {
       "test:game": "playwright test",
       "test:game:ui": "playwright test --ui",
       "test:game:debug": "playwright test --debug"
     }
   }
   ```

5. **Run tests:**
   ```bash
   npm run test:game                    # Headless
   npm run test:game:ui                 # Interactive UI
   npm run test:game:debug              # Step through
   ```

---

## Next Steps

Would you like me to:
1. Create a complete Playwright test suite for Jumper?
2. Set up CI/CD integration with GitHub Actions?
3. Create a test helper library for common Phaser interactions?
4. Implement performance profiling tests?
5. Create a custom test runner dashboard?

