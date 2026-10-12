import Renderer, { MatchResult } from "./engine/Renderer.mjs";
import Consts from "./tools/Consts.mjs";
import FpsCounter from "./tools/FpsCounter.mjs";
import Overlay from "./tools/Overlay.mjs";
import SoundManager from "./tools/SoundManager.mjs";
import TouchControls from "./tools/TouchControls.mjs";

// The states the game can be in
type GameState = "title" | "playing" | "paused" | "gameOver";

document.addEventListener("DOMContentLoaded", async () => {
    // Create scene & overlay
    const renderer = await Renderer.create();
    const overlay = new Overlay();

    // Render the first frame beneath the title screen
    renderer.render();
    overlay.show("SUPER FUSEMAN", "Press any key or tap to start");

    // Create optional debug FPS counter
    const fpsCounter = new URLSearchParams(window.location.search).has("fps") ? new FpsCounter() : null;

    // Game state, shared between the handlers below
    let soundManager: SoundManager;
    let touchControls: TouchControls;
    let state: GameState = "title";
    let isLoading = false; // Guards against loading twice (key & click listeners may both fire)
    let frameId = 0;
    let lastTime = 0;
    let gameOverTimestamp = 0;

    // Store held keys in order of recently pressed
    globalThis.keysHeld = [] as string[];

    // Game loop, driven by requestAnimationFrame
    const tick = (timestamp: number) => {
        // Calculate time elapsed since last frame (in seconds)
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        fpsCounter?.tick(timestamp);

        // Update game state
        renderer.update(dt);

        // Render next frame
        renderer.render();

        // Stop looping if the match has ended
        const result = renderer.getMatchResult();
        if (result) {
            endMatch(result);
            return;
        }

        // Request next frame
        frameId = requestAnimationFrame(tick);
    };

    // Begins the requestAnimationFrame loop, skipping the time elapsed beforehand
    const startLoop = () => {
        frameId = requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            frameId = requestAnimationFrame(tick);
        });
    };

    // Releases all held inputs (keyup events are missed while paused or unfocused)
    const releaseInputs = () => {
        globalThis.keysHeld.length = 0;
        touchControls.releaseAll();
    };

    // Begins playing the current match (either the first one or a freshly reset one)
    const beginPlaying = () => {
        releaseInputs();
        overlay.hide();
        state = "playing";
        startLoop();
    };

    // Ends the match & displays the results
    const endMatch = (result: MatchResult) => {
        state = "gameOver";
        gameOverTimestamp = Date.now();
        releaseInputs();

        // Determine results text
        let title: string;
        switch (result.outcome) {
            case "win": title = `PLAYER ${result.winner} WINS`; break;
            case "draw": title = "DRAW"; break;
            default: title = "GAME OVER"; break;
        }
        overlay.show(title);

        // Only prompt to play again once input is accepted
        setTimeout(() => {
            if (state === "gameOver") overlay.setSubtitle("Press any key or tap to play again");
        }, Consts.MATCH_END_INPUT_DELAY_MS);
    };

    // Pauses the game, such as when the window loses focus
    const pause = () => {
        if (state !== "playing") return;
        state = "paused";

        // Stop the loop (also cancels any frame already requested)
        cancelAnimationFrame(frameId);
        releaseInputs();

        // Freeze audio & prompt to resume (the canvas keeps displaying the last frame)
        soundManager.suspend();
        overlay.show("PAUSED", "Press Escape, click, or tap to resume");
    };

    // Resumes the game after being paused
    const resume = () => {
        soundManager.resume();
        beginPlaying();
    };

    // Handles an input (key press, click, or tap) that isn't gameplay, depending on the state
    const handleInput = async () => {
        switch (state) {
            case "title":
                // Only load once
                if (isLoading) return;
                isLoading = true;

                // Load SoundManager (depends on user-input event)
                soundManager = await SoundManager.create();
                globalThis.playSound = (key: string, volume: number = 1, rate: number = 1) =>
                    soundManager.play(key, volume, rate);

                // Bind touch controls (only visible on touch devices)
                touchControls = new TouchControls(pause);

                beginPlaying();
                break;
            case "paused":
                resume();
                break;
            case "gameOver":
                // Ignore input shortly after the match ends
                if (Date.now() - gameOverTimestamp < Consts.MATCH_END_INPUT_DELAY_MS) return;

                // Start a new match
                renderer.reset();
                beginPlaying();
                break;
        }
    };

    // Bind key event listeners
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        // Escape toggles pause without becoming gameplay input
        if (e.code === "Escape" && (state === "playing" || state === "paused")) {
            e.preventDefault();
            if (!e.repeat) {
                if (state === "playing") pause();
                else resume();
            }
            return;
        }

        // Outside of gameplay, keys only advance the game state (so the key that resumes doesn't also plant a fuse)
        if (state !== "playing") {
            if (!e.repeat) handleInput();
            return;
        }

        if (!globalThis.keysHeld.includes( e.code )) globalThis.keysHeld.push( e.code );
    });
    window.addEventListener("keyup", (e: KeyboardEvent) => {
        if (globalThis.keysHeld.includes(e.code)) globalThis.keysHeld.splice( globalThis.keysHeld.indexOf(e.code), 1 )
    });

    // Bind click listener (also covers taps on mobile)
    window.addEventListener("click", handleInput);

    // Pause when the window loses focus or the tab is hidden
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pause();
    });
});
