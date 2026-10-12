/**
 * A debug frames-per-second counter, enabled by adding "?fps" to the URL
 * 
 * Measures the rate of the requestAnimationFrame loop, which is capped by the browser/display server.
 */
export default class FpsCounter {
    private element: HTMLElement;

    // Frames counted since the last update & the timestamp of that update
    private frames: number;
    private lastUpdateTimestamp: number;

    constructor() {
        this.element = document.createElement("div");
        this.element.id = "fps";
        document.body.appendChild(this.element);

        this.frames = 0;
        this.lastUpdateTimestamp = 0;
    }

    /**
     * Counts a frame, refreshing the displayed value once per second
     */
    tick(timestamp: number) {
        ++this.frames;

        const elapsed = timestamp - this.lastUpdateTimestamp;
        if (elapsed >= 1000) {
            this.element.textContent = Math.round(this.frames * 1000 / elapsed) + " FPS";
            this.frames = 0;
            this.lastUpdateTimestamp = timestamp;
        }
    }
};
