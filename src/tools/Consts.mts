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

    // The duration of each Fuse before blowing, in seconds
    FUSE_TIMER_SEC: 2.5,

    // The duration of each Blast before disappearing, in seconds
    BLAST_TIMER_SEC: 0.5,

    // The duration of each MutableTile's destruction animation before disappearing, in seconds
    TILE_CRUMBLE_TIMER_SEC: 0.05,

    // The duration of each Collectible's destruction animation before disappearing, in seconds
    COLLECTIBLE_DESTROY_TIMER_SEC: 0.25,

    // The odds that a Collectible spawns when a MutableTile breaks
    COLLECTIBLE_SPAWN_RATE: 0.5,

    // How long a mystery Collectible power-up lasts, in seconds
    MYSTERY_COLLECTIBLE_TIMER_SEC: 20,

    // Default key mappings for Fuseman
    KEYS: {
        LEFT: "KeyA",
        RIGHT: "KeyD",
        UP: "KeyW",
        DOWN: "KeyS",
        PLANT: "KeyK"
    },

    // The number of themes available in the spritesheet
    NUM_THEMES: 1,

    // The interval of time between the start of two footstep sound effects, in milliseconds
    FOOTSTEP_SFX_INTERVAL_MS: 280
});
