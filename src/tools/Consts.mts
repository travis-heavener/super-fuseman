export default Object.freeze({
    // Dimensions of grid in tiles, with and without outer boundary wall
    TILES_ACROSS: 13,
    TILES_DOWN: 11,
    get TILES_ACROSS_EXTERIOR() { return this.TILES_ACROSS + 2 },
    get TILES_DOWN_EXTERIOR() { return this.TILES_DOWN + 2 },

    // Simulated pixel sizes of offscreen canvas (pre-transposing to visual canvas)
    get WIDTH_PX() { return this.TILES_ACROSS_EXTERIOR * 16 },
    get HEIGHT_PX() { return this.TILES_DOWN_EXTERIOR * 16 },

    // Animation frame tick interval, in milliseconds
    ANIMATION_FRAME_INTERVAL_MS: 120,

    // Movement speed in pixels/second for Fuseman
    FUSEMAN_SPEED_PX_PER_SEC: 48,

    // Default key mappings for Fuseman
    KEYS: {
        LEFT: "KeyA",
        RIGHT: "KeyD",
        UP: "KeyW",
        DOWN: "KeyS",
        PLANT: "KeyE"
    },

    // The number of themes available in the spritesheet
    NUM_THEMES: 1
});
