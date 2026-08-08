import Renderer from "./engine/Renderer.mjs";
import Fuseman from "./sprites/Fuseman.mjs";
import Point2 from "./tools/Point2.mjs";

document.addEventListener("DOMContentLoaded", async () => {
    // Begin requestAnimationFrame loop
    const renderer = await Renderer.create();
    let lastTime = 0;

    // Add sprites to renderer
    renderer.addSprite(
        new Fuseman(new Point2(0, 0), 1)
    );

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
