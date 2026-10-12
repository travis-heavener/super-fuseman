import Renderer, { type MatchResult } from "./engine/Renderer.mjs";
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
    const warning = document.getElementById("warning") as HTMLElement;
    const scores = document.getElementById("scores") as HTMLElement;
    const matchClock = document.getElementById("match-clock") as HTMLElement;
    const clockValue = document.getElementById("clock-value") as HTMLElement;

    // Build one score card per player using the same idle art as the game
    const wins = [0, 0, 0, 0, 0];
    const scoreCards: HTMLElement[] = [];
    const scoreLabels: HTMLElement[] = [];
    for (let playerNumber = 1; playerNumber <= 5; ++playerNumber) {
        const card = document.createElement("div");
        card.className = "player-score";

        // The 16x32 sprite is drawn once; CSS scales it without blurring
        const portrait = document.createElement("canvas");
        portrait.width = 16;
        portrait.height = 32;
        portrait.setAttribute("aria-hidden", "true");
        portrait.getContext("2d")!.drawImage(renderer.getPlayerPortrait(playerNumber), 0, 0);

        const details = document.createElement("div");
        details.className = "score-details";
        const playerLabel = document.createElement("span");
        playerLabel.className = "score-player";
        playerLabel.textContent = `P${playerNumber}`;
        const scoreLabel = document.createElement("span");
        scoreLabel.className = "score-wins";
        details.append(playerLabel, scoreLabel);
        card.append(portrait, details);
        scores.append(card);
        scoreCards.push(card);
        scoreLabels.push(scoreLabel);
    }

    // The win totals last for this page session and reset on refresh
    const updateScores = () => {
        for (let i = 0; i < wins.length; ++i) {
            scoreLabels[i].textContent = `${wins[i]}`;
            scoreCards[i].setAttribute("aria-label", `Player ${i + 1}: ${wins[i]} wins`);
        }
    };
    updateScores();

    // Format elapsed match time as minutes and seconds, including sudden death
    const updateClock = () => {
        const seconds = Math.floor(renderer.getMatchTime());
        const clockText = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:` +
            `${(seconds % 60).toString().padStart(2, "0")}`;
        if (clockValue.textContent !== clockText) {
            clockValue.textContent = clockText;
            matchClock.setAttribute("aria-label", `Match time ${clockText}`);
        }
    };

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

    // Ask before discarding a match; paused games are still in progress
    const preventMatchExit = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = true;
    };

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
        updateClock();

        // Show the approaching arena closure without obscuring the match
        const warningText = renderer.getSuddenDeathWarning() || "";
        if (warning.textContent !== warningText) warning.textContent = warningText;
        warning.classList.toggle("visible", warningText !== "");

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
        window.addEventListener("beforeunload", preventMatchExit);
        startLoop();
    };

    // Ends the match & displays the results
    const endMatch = (result: MatchResult) => {
        state = "gameOver";
        gameOverTimestamp = Date.now();
        window.removeEventListener("beforeunload", preventMatchExit);
        releaseInputs();
        warning.classList.remove("visible");

        // Credit the survivor once before showing the result
        if (result.outcome === "win" && result.winner) {
            ++wins[result.winner - 1];
            updateScores();
        }

        // Determine results text
        let title: string;
        switch (result.outcome) {
            case "win": title = `PLAYER ${result.winner} WINS`; break;
            case "draw": title = "DRAW"; break;
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
                updateClock();
                warning.classList.remove("visible");
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
