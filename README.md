# Mobile Web Testing Framework

> A modular, open-source wrapper around **Selenium WebDriver 4+** for responsive mobile web testing using **Chrome DevTools Protocol (CDP)** emulation — **no Appium required**.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Device Profiles](#device-profiles)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [Publishing to NPM](#publishing-to-npm)
- [License](#license)

---

## Features

- **Zero Appium dependency** — emulates mobile devices using CDP built into Chrome.
- **Device Profiles** — ships with pre-configured profiles for iPhone 15, Pixel 8, iPad Air, Samsung Galaxy S24, and iPhone SE.
- **Touch Actions** — tap, long-press, swipe (up/down/left/right), and pixel-scroll utilities.
- **Screenshot support** — capture Base64 or save PNG to disk.
- **NPM-ready** — structured for easy publishing as a reusable package.
- **ES6+ & JSDoc** — modern `async/await`, classes, destructuring, with full documentation.

---

## Project Structure

```
mobile-web-testing-framework/
├── index.js                         # NPM package entry point
├── package.json
├── .gitignore / .npmignore
├── LICENSE
├── README.md
├── .mocharc.yml                     # Mocha configuration
│
├── src/
│   ├── index.js                     # Barrel export
│   ├── core/
│   │   └── MobileDriver.js          # Core Selenium + CDP wrapper class
│   ├── utils/
│   │   └── touchActions.js          # Touch action utilities
│   └── config/
│       └── deviceProfiles.json      # Device metrics & user-agent strings
│
├── tests/
│   └── example.test.js              # Mocha + Chai integration test
│
└── examples/
    └── basicUsage.js                # Standalone usage example
```

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| **Node.js** | >= 16   |
| **Google Chrome** | Latest stable |
| **ChromeDriver** | Matching your Chrome version (auto-managed by `selenium-webdriver` v4.6+) |

### 1. Clone & Install

```bash
git clone <your-repo-url> mobile-web-testing-framework
cd mobile-web-testing-framework
npm install
```

### 2. Run the Example Test

```bash
npm test
```

### 3. Run the Standalone Example

```bash
npm run example
```

---

## Device Profiles

Device profiles live in [`src/config/deviceProfiles.json`](src/config/deviceProfiles.json).

| Key | Device | Viewport | DPR | Mobile |
|-----|--------|----------|-----|--------|
| `iPhone_15` | iPhone 15 | 393 × 852 | 3 | Yes |
| `Pixel_8` | Pixel 8 | 412 × 915 | 2.625 | Yes |
| `iPad_Air` | iPad Air | 820 × 1180 | 2 | Yes |
| `Samsung_Galaxy_S24` | Galaxy S24 | 360 × 780 | 3 | Yes |
| `iPhone_SE` | iPhone SE | 375 × 667 | 2 | Yes |
| `Nothing_Phone_1` | Nothing Phone 1 | 393 × 851 | 2.75 | Yes |

### Adding a Custom Device

Add a new entry to `deviceProfiles.json`:

```json
{
  "My_Custom_Device": {
    "deviceName": "My Custom Device",
    "width": 400,
    "height": 900,
    "deviceScaleFactor": 2.5,
    "mobile": true,
    "userAgent": "Mozilla/5.0 ..."
  }
}
```

Or pass a custom JSON path:

```js
const mobile = new MobileDriver('My_Custom_Device', {
  profilesPath: '/path/to/custom-profiles.json',
});
```

---

## API Reference

### `MobileDriver` (class)

```js
const { MobileDriver } = require('mobile-web-testing-framework');
```

| Method | Description |
|--------|-------------|
| `constructor(deviceName, options?)` | Load device profile. Options: `profilesPath`, `headless`, `additionalArgs`. |
| `start()` → `Promise<WebDriver>` | Build Chrome session & apply CDP emulation. |
| `stop()` → `Promise<void>` | Quit the browser. |
| `navigateTo(url)` | Navigate to a URL. |
| `getTitle()` | Get current page title. |
| `takeScreenshot()` | Returns Base64 PNG. |
| `saveScreenshot(path)` | Saves PNG to disk. |
| `executeScript(script, ...args)` | Run JS in page context. |
| `sendCdpCommand(method, params?)` | Send raw CDP command. |
| `.profile` (getter) | Read-only device profile object. |
| `.driver` (getter) | Underlying WebDriver instance. |

### `touchActions` (module)

```js
const { touchActions } = require('mobile-web-testing-framework');
const { tap, longPress, swipeUp, swipeDown, swipeLeft, swipeRight, scrollByPixels } = touchActions;
```

| Function | Description |
|----------|-------------|
| `tap(driver, cssSelector, options?)` | Touch-tap an element. |
| `longPress(driver, cssSelector, options?)` | Touch-and-hold. |
| `swipeUp(driver, options?)` | Swipe up (scroll down). Options: `distance`, `duration`, `steps`. |
| `swipeDown(driver, options?)` | Swipe down (scroll up). |
| `swipeLeft(driver, options?)` | Swipe left. |
| `swipeRight(driver, options?)` | Swipe right. |
| `scrollByPixels(driver, pixels?)` | Smooth-scroll by pixel amount. |

---

## Running Tests

```bash
# Run the full Mocha test suite
npm test

# Verbose reporter
npm run test:verbose
```

The test suite launches a **headless** Chrome instance emulating an iPhone 15, navigates to `https://example.com`, performs gestures, and validates results.

---

## Publishing to NPM

1. Update `version` in `package.json`.
2. Set `author`, `repository.url`, and `description` as needed.
3. Run:

```bash
npm login
npm publish
```

The `.npmignore` ensures only production files (`index.js`, `src/`, `README.md`, `LICENSE`) are included in the published package.

---

## License

[MIT](LICENSE)
