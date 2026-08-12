import Consts from "../tools/Consts.mjs";

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
    "die": number[],
    "shadow": number
};

/**
 * Tile spritesheet map
 */
type TileSpriteMap = {
    "frames": ImageBitmap[],
    "immutableTile": number[],
    "mutableTile": number[],
    "mutableTileCrumbling": number[][], // [themeIndex][frameIndex]
    "backgroundTile": number[],
    "fuse": number[],
    "blast": {
        "center": number[],
        "middle": number[],
        "end": number[]
    }
};

// Base path to resource files
const resPath = "../../res";

/**
 * Loads textures into memory (small footprint for 16x16 graphics).
 */
export default class Textures {
    fusers: FusemanSpriteMap[];
    tiles: TileSpriteMap;
    initPrompt: ImageBitmap;

    private constructor(fusers: FusemanSpriteMap[], tiles: TileSpriteMap, initPrompt: ImageBitmap) {
        this.fusers = fusers;
        this.tiles = tiles;
        this.initPrompt = initPrompt;
    }

    /**
     * Loads spritemaps asynchronously to create a Textures class
     * 
     * Fuseman spritesheet:
     * 0..2:   move downward (0 is idle pose as well)
     * 3..5:   move right
     * 6..8:   move up
     * 9..11:  death animation
     * 12:     sprite shadow
     * 13..15: move left (not on spritesheet, just the 'move right' frames but flipped in memory)
     */
    static async create() {
        // Load Fuseman spritesheet bitmap
        const fusers = [] as FusemanSpriteMap[];
        {
            const fusersSpritesheet = await Textures.loadSpritemap(resPath + "/gfx/fuseman.png");

            // Iterate for each Fuseman
            for (let i = 0; i < 5; ++i) {
                // Piece apart individual frames
                const y = i * 32;
                const frames = [];
                for (let j = 0; j < 13; ++j) {
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
                    "die": [9, 10, 11, 10, 11, 10, 11, 10, 11, 10, 11, 10],
                    "shadow": 12,
                    "moveLeft": [13, 14, 13, 15]
                } as FusemanSpriteMap);
            }

            // Free spritesheet
            fusersSpritesheet.close();
        }

        // Load tiles & items spritesheet bitmap
        const tiles = {} as TileSpriteMap;
        {
            const tilesSpritesheet = await Textures.loadSpritemap(resPath + "/gfx/tiles.png");
            tiles.frames = [];

            // Push mutable & immutable tiles
            tiles.immutableTile = [];
            tiles.mutableTile = [];
            tiles.mutableTileCrumbling = [];
            tiles.backgroundTile = [];

            // Pre-load mutable tile crumbling mask
            const mutableTileCrumbleMask = [
                await createImageBitmap( tilesSpritesheet,  0, 48, 16, 16 ),
                await createImageBitmap( tilesSpritesheet, 16, 48, 16, 16 ),
                await createImageBitmap( tilesSpritesheet, 32, 48, 16, 16 )
            ];

            // For each theme...
            for (let i = 0; i < Consts.NUM_THEMES; ++i) {
                tiles.frames.push(
                    await createImageBitmap( tilesSpritesheet, i * 16,  0, 16, 16 ), // Immutable tile
                    await createImageBitmap( tilesSpritesheet, i * 16, 16, 16, 16 ), // Mutable tile
                    await createImageBitmap( tilesSpritesheet, i * 16, 32, 16, 16 )  // Background tile
                );

                const mutableTileIndex = tiles.frames.length - 2;
                tiles.immutableTile.push(tiles.frames.length - 3);
                tiles.mutableTile.push(mutableTileIndex);
                tiles.backgroundTile.push(tiles.frames.length - 1);

                // Generate crumbling frames for mutable tiles
                tiles.frames.push(
                    await Textures.createMaskedBitmap( tiles.frames[mutableTileIndex], mutableTileCrumbleMask[0] ),
                    await Textures.createMaskedBitmap( tiles.frames[mutableTileIndex], mutableTileCrumbleMask[1] ),
                    await Textures.createMaskedBitmap( tiles.frames[mutableTileIndex], mutableTileCrumbleMask[2] )
                );
                tiles.mutableTileCrumbling.push([
                    tiles.frames.length - 3,
                    tiles.frames.length - 2,
                    tiles.frames.length - 1
                ]);
            }

            // Load fuse textures
            tiles.fuse = [];
            for (let i = 0; i < 6; ++i) {
                tiles.frames.push( await createImageBitmap( tilesSpritesheet, i * 16, 96, 16, 16 ) );
                tiles.fuse.push(tiles.frames.length - 1);
            }

            // Load blast textures
            tiles.blast = { "center": [], "middle": [], "end": [] };
            for (let i = 0; i < 6; ++i) {
                tiles.frames.push(await createImageBitmap( tilesSpritesheet, i * 16, 112, 16, 16 ));
                tiles.blast.center.push(tiles.frames.length - 1);
            }

            for (let i = 0; i < 6; ++i) {
                tiles.frames.push(await createImageBitmap( tilesSpritesheet, i * 16, 128, 16, 16 ));
                tiles.blast.middle.push(tiles.frames.length - 1);
            }

            for (let i = 0; i < 6; ++i) {
                tiles.frames.push(await createImageBitmap( tilesSpritesheet, i * 16, 144, 16, 16 ));
                tiles.blast.end.push(tiles.frames.length - 1);
            }

            // Free spritesheet
            tilesSpritesheet.close();
        }

        // Load initial prompt
        const initPrompt = await createImageBitmap( await Textures.loadSpritemap(resPath + "/gfx/init.png") );

        // Create Textures
        return new Textures(fusers, tiles, initPrompt);
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

    /**
     * Creates a masked bitmap where the mask removes pixels from the base texture
     */
    private static async createMaskedBitmap(base: ImageBitmap, mask: ImageBitmap) {
        // Create offscreen canvas
        const canvas = new OffscreenCanvas(16, 16);
        canvas.width = canvas.height = 16;

        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
        ctx.imageSmoothingEnabled = false;

        // Draw base texture
        ctx.drawImage(base, 0, 0);

        // Switch mode to erase
        ctx.globalCompositeOperation = "destination-out";

        // Draw mask
        ctx.drawImage(mask, 0, 0);

        // Convert to bitmap image
        return await createImageBitmap(canvas);
    }
};
