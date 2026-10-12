import Consts from "./Consts.mjs";

/**
 * On-screen touch controls for mobile (D-pad on the left, plant button on the right)
 * 
 * Touches are translated into the same key codes as the keyboard, so Fuseman needs no knowledge of them.
 */
export default class TouchControls {
    private container: HTMLElement;
    private dpad: HTMLElement;
    private plantButton: HTMLElement;
    private pauseButton: HTMLButtonElement;

    // The D-pad's arm elements, by direction
    private arms: Map<string, HTMLElement>;

    // The pointer currently driving the D-pad, or null if untouched
    private dpadPointerId: number | null;

    // The key currently held by the D-pad, or null if centered
    private dpadKey: string | null;

    constructor(onPause: () => void) {
        this.container = document.getElementById("touch-controls") as HTMLElement;
        this.dpad = document.getElementById("dpad") as HTMLElement;
        this.plantButton = document.getElementById("plant-button") as HTMLElement;
        this.pauseButton = document.getElementById("pause-button") as HTMLButtonElement;

        // Locate each D-pad arm
        this.arms = new Map();
        for (const dir of ["up", "down", "left", "right"]) {
            this.arms.set(dir, this.dpad.querySelector(`[data-dir="${dir}"]`) as HTMLElement);
        }

        this.dpadPointerId = null;
        this.dpadKey = null;

        // Bind D-pad listeners (pointer capture lets a thumb slide between directions)
        this.dpad.addEventListener("pointerdown", (e: PointerEvent) => {
            if (this.dpadPointerId !== null) return;
            this.dpadPointerId = e.pointerId;
            this.dpad.setPointerCapture(e.pointerId);
            this.updateDpad(e);
        });
        this.dpad.addEventListener("pointermove", (e: PointerEvent) => {
            if (e.pointerId === this.dpadPointerId) this.updateDpad(e);
        });
        for (const type of ["pointerup", "pointercancel"]) {
            this.dpad.addEventListener(type, (e: Event) => {
                if ((e as PointerEvent).pointerId === this.dpadPointerId) this.releaseDpad();
            });
        }

        // Pause on a click, stopping that same click from immediately resuming the overlay
        this.pauseButton.addEventListener("click", (e: MouseEvent) => {
            e.stopPropagation();
            onPause();
        });

        // Bind plant button listeners
        this.plantButton.addEventListener("pointerdown", (e: PointerEvent) => {
            this.plantButton.setPointerCapture(e.pointerId);
            this.plantButton.classList.add("active");
            this.pressKey(Consts.KEYS.PLANT);
        });
        for (const type of ["pointerup", "pointercancel"]) {
            this.plantButton.addEventListener(type, () => {
                this.plantButton.classList.remove("active");
                this.releaseKey(Consts.KEYS.PLANT);
            });
        }

        // Disable context menus (long-presses)
        this.container.addEventListener("contextmenu", e => e.preventDefault());

        // Reveal the controls (CSS still hides them on non-touch devices)
        this.container.classList.add("enabled");
    }

    /**
     * Releases all touch inputs, used when pausing so no input gets stuck
     */
    releaseAll() {
        this.releaseDpad();
        this.plantButton.classList.remove("active");
        this.releaseKey(Consts.KEYS.PLANT);
        this.dpadPointerId = null;
    }

    /**
     * Determines which direction a touch on the D-pad is pointing & updates the held key
     */
    private updateDpad(e: PointerEvent) {
        // Determine touch offset from the D-pad's center
        const rect = this.dpad.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);

        // Ignore touches in the center deadzone
        let direction: string | null = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > Consts.DPAD_DEADZONE * (rect.width / 2)) {
            // Choose the dominant axis (movement is 4-directional)
            if (Math.abs(dx) > Math.abs(dy)) direction = (dx < 0) ? "left" : "right";
            else direction = (dy < 0) ? "up" : "down";
        }

        // Swap held key, if changed
        const key = direction ? Consts.KEYS[direction.toUpperCase() as "LEFT" | "RIGHT" | "UP" | "DOWN"] : null;
        if (key === this.dpadKey) return;

        if (this.dpadKey) this.releaseKey(this.dpadKey);
        if (key) this.pressKey(key);
        this.dpadKey = key;

        // Highlight the active arm
        this.arms.forEach((arm, dir) => arm.classList.toggle("active", dir === direction));
    }

    /**
     * Releases the D-pad
     */
    private releaseDpad() {
        if (this.dpadKey) this.releaseKey(this.dpadKey);
        this.dpadKey = null;
        this.dpadPointerId = null;
        this.arms.forEach(arm => arm.classList.remove("active"));
    }

    /**
     * Marks a key as held, in order of recently pressed (same as keyboard events)
     */
    private pressKey(code: string) {
        if (!globalThis.keysHeld.includes(code)) globalThis.keysHeld.push(code);
    }

    /**
     * Marks a key as released
     */
    private releaseKey(code: string) {
        if (globalThis.keysHeld.includes(code)) globalThis.keysHeld.splice( globalThis.keysHeld.indexOf(code), 1 );
    }
};
