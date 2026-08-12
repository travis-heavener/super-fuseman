import Renderer from "./engine/Renderer.mjs";
import SoundManager from "./tools/SoundManager.mjs";

document.addEventListener("DOMContentLoaded", async () => {
    // Create scene & run initial render
    const renderer = await Renderer.create();
    renderer.initialRender();

    // Bind start button
    window.addEventListener("keydown", async function() {
        // Load SoundManager (depends on user-input event)
        const soundManager = await SoundManager.create();
        globalThis.playSound = (key: string, volume: number = 1) => soundManager.play(key, volume);

        // Store held keys in order of recently pressed
        globalThis.keysHeld = [] as string[];

        // Bind key event listeners
        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (!globalThis.keysHeld.includes( e.code )) globalThis.keysHeld.push( e.code );
        });
        window.addEventListener("keyup", (e: KeyboardEvent) => {
            if (globalThis.keysHeld.includes(e.code)) globalThis.keysHeld.splice( globalThis.keysHeld.indexOf(e.code), 1 )
        });

        // Begin requestAnimationFrame loop
        let lastTime = 0;
        const tick = (timestamp: number) => {
            // Calculate time elapsed since last frame (in seconds)
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            // Update game state
            renderer.update(dt);

            // Render next frame
            renderer.render();

            // Request next frame
            requestAnimationFrame(tick);
        };

        requestAnimationFrame((timestamp) => {
            lastTime = timestamp;
            requestAnimationFrame(tick);
        });
    }, { once: true });
});
