# TS-Phaser-Game-Jumper — Playwright POC Clone

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-43853d.svg)
![Phaser](https://img.shields.io/badge/Phaser-3.90.0-orange.svg)
![Playwright](https://img.shields.io/badge/Playwright-1.x-2EAD33.svg)

This is a clone of the original [TS-Phaser-Game-Jumper](https://github.com/TorresjDev/TS-Phaser-Game-Jumper) repository, used as a proof of concept for integrating [Playwright](https://playwright.dev/) end-to-end testing into a Phaser 3 + TypeScript game.

Disclaimer: this is not a production ready polished project, the goal was to build out a proof-of-concept and this goal has been achieved. 

The original game code is preserved as-is, with one minor change to [src/main.ts](src/main.ts): the Phaser game instance is exposed on `window.game` so Playwright tests can interact with it directly.

```ts
if (typeof window !== 'undefined') {
  (window as any).game = game;
}
```

## Playwright integration

End-to-end tests and setup are located in the [playwright/](playwright/) subfolder. See the [playwright/README.md](playwright/README.md) for details on how the tests are structured and how to run them.

## AI assistance

This proof of concept was built with the help of Claude (Anthropic's AI agent) via Claude Code, which assisted in scaffolding the Playwright test setup, writing tests, and debugging integration issues.

