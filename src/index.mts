import Renderer from "./engine/Renderer.mjs";

document.addEventListener("DOMContentLoaded", async () => {
    // Begin requestAnimationFrame loop
    const renderer = await Renderer.create();
    let lastTime = 0;

    // Start tick loop
    const tick = (timestamp: number) => {
        // Calculate time elapsed since last frame (in seconds)
        const dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // Update game state
        // TODO

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
