import Renderer from "./engine/Renderer.mjs";

document.addEventListener("DOMContentLoaded", async () => {
    // Store held keys in order of recently pressed
    globalThis.keysHeld = [] as string[];

    // Bind key event listeners
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (!globalThis.keysHeld.includes( e.code )) globalThis.keysHeld.push( e.code );
    });
    window.addEventListener("keyup", (e: KeyboardEvent) => {
        globalThis.keysHeld.splice( globalThis.keysHeld.indexOf(e.code), 1 )
    });

    // Begin requestAnimationFrame loop
    const renderer = await Renderer.create();
    let lastTime = 0;

    // Start tick loop
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
});
