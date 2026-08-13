// Base path to resource files
const resPath = "../../res";

/**
 * Controls sound effects for the game
 */
export default class SoundManager {
    private ctx: AudioContext;
    private buffers: Map<string, AudioBuffer>;

    private constructor() {
        this.ctx = new AudioContext;
        this.buffers = new Map();
    }

    static async create() {
        // Load sfx
        const sm = new SoundManager();
        await sm.loadSound("footstep", resPath + "/sfx/footstep.wav");
        await sm.loadSound("explosion", resPath + "/sfx/explosion.wav");
        await sm.loadSound("death", resPath + "/sfx/death.wav");
        await sm.loadSound("place_fuse", resPath + "/sfx/place_fuse.wav");

        // Return new SoundManager
        return sm;
    }

    /**
     * Loads an audio file to memory
     */
    private async loadSound(key: string, path: string) {
        const res = await fetch(path);
        this.buffers.set(
            key,
            await this.ctx.decodeAudioData( await res.arrayBuffer() )
        );
    }

    /**
     * Plays a loaded sound effect
     */
    play(key: string, volume: number = 1) {
        const buffer = this.buffers.get(key);
        if (!buffer) return;

        // Resume context if browser suspended it
        if (this.ctx.state === "suspended") this.ctx.resume();

        // Create a source node (one-time use per playback)
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        // Add gain node for volume control
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        // Play sound
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
    }
};
