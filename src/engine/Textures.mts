/**
 * Fuseman spritesheet map
 */
type FusemanSpriteMap = {
    "frames": ImageBitmap[],
    "idle": number,
    "moveDown": number[],
    "moveRight": number[],
    "moveLeft": number[],
    "moveUp": number[],
    "die": number[]
};

// Base path to resource files
const resPath = "../../res";

/**
 * Loads textures into memory (small footprint for 16x16 graphics).
 */
export default class Textures {
    fusers: FusemanSpriteMap[];

    private constructor(fusers: FusemanSpriteMap[]) {
        this.fusers = fusers;
    }

    /**
     * Loads spritemaps asynchronously to create a Textures class
     * 
     * Fuseman spritesheet:
     * 0..2:   move downward (0 is idle pose as well)
     * 3..5:   move right
     * 6..8:   move up
     * 9..11:  death animation
     * 12..14: move left (not on spritesheet, just the 'move right' frames but flipped in memory)
     */
    static async create() {
        // Load Fuseman spritesheet bitmap
        const fusersSpritesheet = await Textures.loadSpritemap(resPath + "/gfx/fuseman.bmp");

        // Unpack fusers spritesheet
        const fusers = [] as FusemanSpriteMap[];

        // Iterate for each Fuseman
        for (let i = 0; i < 5; ++i) {
            // Piece apart individual frames
            const y = i * 32;
            const frames = [];
            for (let j = 0; j < 12; ++j) {
                frames.push( await createImageBitmap( fusersSpritesheet, j * 16, y, 16, 32 ) );
            }

            // Flip bitmap for left movement
            frames.push(
                await Textures.createFlippedBitmap( fusersSpritesheet, 48, y, 16, 32 ),
                await Textures.createFlippedBitmap( fusersSpritesheet, 64, y, 16, 32 ),
                await Textures.createFlippedBitmap( fusersSpritesheet, 80, y, 16, 32 )
            );

            // Append FusemanSpriteMap
            fusers.push({
                "frames": frames,
                "idle": 0,
                "moveDown": [0, 1, 0, 2],
                "moveRight": [3, 4, 3, 5],
                "moveUp": [6, 7, 6, 8],
                "die": [9, 10, 11],
                "moveLeft": [12, 13, 12, 14]
            } as FusemanSpriteMap);
        }

        // Free spritesheet
        fusersSpritesheet.close();

        // Create Textures
        return new Textures(fusers);
    }

    /**
     * Loads a spritemap from memory to a bitmap image
     * 
     * Spritemaps are 256x256 each.
     */
    private static async loadSpritemap(path: string) {
        // Fetch blob and create bitmap
        const response = await fetch(path);
        const blob = await response.blob();
        return await createImageBitmap(blob);
    }

    /**
     * Creates a horizontally flipped bitmap
     */
    private static async createFlippedBitmap(img: ImageBitmap, x: number, y: number, w: number, h: number) {
        // Crop original sprite frame
        const original = await createImageBitmap(img, x, y, w, h);

        // Flip horizontally using offscreen canvas
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d") as any;
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(original, 0, 0);
        
        // 3. Convert back to an ImageBitmap
        return await createImageBitmap(canvas);
    }
};
