import Consts from "../tools/Consts.mjs";
import Fuseman from "../sprites/Fuseman.mjs";
import Textures from "./Textures.mjs";
import Sprite from "../sprites/Sprite.mjs";
import ImmutableTile from "../sprites/ImmutableTile.mjs";
import MutableTile from "../sprites/MutableTile.mjs";
import Point2 from "../tools/Point2.mjs";

/**
 * A renderer class that holds references to all sprites.
 * 
 * The draw() method is invoked by the requestAnimationFrame loop to render a frame.
 */
export default class Renderer {
    private fusers: Fuseman[];
    private grid: (Sprite | null)[][];

    private textures: Textures;
    private themeIndex: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private constructor(textures: Textures) {
        this.fusers = [];
        this.canvas = document.getElementsByTagName("canvas")[0];
        this.ctx = this.canvas.getContext("2d") as any;

        // Update canvas sizing
        this.canvas.width = Consts.WIDTH_PX;
        this.canvas.height = Consts.HEIGHT_PX;

        // Disable image smoothing (for pixel art)
        this.ctx.imageSmoothingEnabled = false;

        // Load textures
        this.textures = textures;

        // Choose a map theme
        this.themeIndex = Math.floor(Math.random() * Consts.NUM_THEMES);

        // Initialize empty grid
        this.grid = [];
        for (let x = 0; x < Consts.TILES_ACROSS_EXTERIOR; ++x) {
            this.grid.push([]);
            for (let y = 0; y < Consts.TILES_DOWN_EXTERIOR; ++y) {
                this.grid[x].push(null);
            }
        }

        // Create sprites
        this.createSprites();
    }

    static async create() {
        return new Renderer( await Textures.create() );
    }

    /**
     * Creates sprites at game load
     */
    private createSprites() {
        // Create Fuseman sprites
        this.fusers.push(
            new Fuseman(new Point2(16, 16), 1)
        );

        // Create immutable tiles
        const tilesAcrossExt = Consts.TILES_ACROSS_EXTERIOR;
        const tilesDownExt = Consts.TILES_DOWN_EXTERIOR;

        // Horizontal borders
        for (let x = 0; x < tilesAcrossExt; ++x) {
            this.grid[x][0]                = new ImmutableTile( new Point2(x * 16, 0), this.themeIndex );
            this.grid[x][tilesDownExt - 1] = new ImmutableTile( new Point2(x * 16, (tilesDownExt - 1) * 16), this.themeIndex );
        }

        // Vertical borders
        for (let y = 0; y < tilesDownExt; ++y) {
            // Skip already filled
            if (y === 0 || y === tilesDownExt - 1) continue;
            this.grid[0][y]                  = new ImmutableTile( new Point2(0, y * 16), this.themeIndex );
            this.grid[tilesAcrossExt - 1][y] = new ImmutableTile( new Point2((tilesAcrossExt - 1) * 16, y * 16), this.themeIndex );
        }

        // Central immutable tiles
        for (let x = 2; x < tilesAcrossExt - 2; x += 2)
            for (let y = 2; y < tilesDownExt - 2; y += 2)
                this.grid[x][y] = new ImmutableTile( new Point2(x * 16, y * 16), this.themeIndex );

        // Fill in remaining spaces with mutable tiles
        for (let x = 0; x < tilesAcrossExt; ++x) {
            for (let y = 0; y < tilesDownExt; ++y) {
                // Skip filled space
                if (this.grid[x][y]) continue;

                // Protect player spawn spaces
                if ( (y === 1 || y === tilesDownExt - 2) && (x <= 3 || x >= tilesAcrossExt - 4) ) continue;
                if ( (x === 1 || x === tilesAcrossExt - 2) && (y <= 3 || y >= tilesDownExt - 4) ) continue;
                if ( x === Math.floor(tilesAcrossExt / 2) && Math.abs(y - Math.floor(tilesDownExt / 2)) <= 2 ) continue;

                this.grid[x][y] = new MutableTile( new Point2(x * 16, y * 16), this.themeIndex );
            }
        }

        // Randomly remove between 3 and 7 mutable tiles
        const numMutableTilesToRemove = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < numMutableTilesToRemove; ++i) {
            let x: number, y: number;
            do {
                x = Math.floor(Math.random() * tilesAcrossExt);
                y = Math.floor(Math.random() * tilesDownExt);
            } while (this.grid[x][y] === null || !(this.grid[x][y] instanceof MutableTile));

            // Remove this tile
            this.grid[x][y] = null;
        }
    }

    /**
     * Calls the draw method on each sprite
     */
    render() {
        // Draw to canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw tiles first
        for (let x = 0; x < this.grid.length; ++x) {
            for (let y = 0; y < this.grid[x].length; ++y) {
                if (this.grid[x][y]) {
                    this.grid[x][y]!.draw(this.ctx, this.textures);
                } else {
                    this.ctx.drawImage(
                        this.textures.tiles.frames[ this.textures.tiles.backgroundTile[this.themeIndex] ],
                        x * 16, y * 16,
                        16, 16
                    );
                }
            }
        }

        // Draw Fusers overtop
        for (const f of this.fusers) f.draw(this.ctx, this.textures);
    }
};
