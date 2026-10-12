# Super Fuseman
### Travis Heavener

## About
I always really enjoyed playing Bomberman '93, specifically the "Battle Game" mode. I attempted to recreate it almost 7 years ago (late 2019) but never went fully through with it.

Rather than digging through ROMs available online for the sprite sheets and sound effects, I've instead resorted to making my own Bomberman '93 clone.

The inspiration for the name is really just a mix of a few ideas that Gemini threw my way when I told it about this project. The terms "vector" and "matrix" really resonated with me as well as the title "Fuse & Fury" (I have no idea if any of these names are actually in use). Super Fuseman is ultimately what I ended up going with since it seemed relevant enough to the Bomberman scene.

As for why I'm doing this in web JavaScript, I really just wanted to do a throwback since the HTML canvas stack is exactly where I started making games about a decade ago and it seemed fitting. It's simple and extensive, and that's all I really need.

## Getting Started

1. Run `npm i` in the project root to install dependencies.
2. Run `npx tsc` to compile the TypeScript files.
3. Using your HTTP server of choice, point your document root at this project directory.
4. Open the game via localhost and enjoy!

## Controls

Move with WASD and place a fuse with K. Press Escape to pause or resume. On touch devices, use the D-pad, PLANT button, and pause button.

Acquired upgrades and active temporary power-ups scatter on death. An animated shimmer marks affected players. If you die, the match continues until one player remains or everyone is out.

## Debugging

### FPS Counter
Append `?fps` to the URL (e.g. `http://localhost:8080/?fps`) to show a frames-per-second counter in the top-left corner of the page.

The counter measures the rate of the browser's `requestAnimationFrame` loop, which is capped by the browser and display server, so it's useful for telling a slow game apart from a slow display.
