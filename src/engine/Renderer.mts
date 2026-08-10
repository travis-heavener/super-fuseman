import Consts from "../tools/Consts.mjs";
import Blast from "../sprites/Blast.mjs";
import Fuse from "../sprites/Fuse.mjs";
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
    private mutableTiles: MutableTile[];
    private fuses: Fuse[];
    private blasts: Blast[];
    private grid: (Sprite | null)[][];

    private textures: Textures;
    private themeIndex: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private constructor(textures: Textures) {
        this.fusers = [];
        this.mutableTiles = [];
        this.fuses = [];
        this.blasts = [];

        this.canvas = document.getElementsByTagName("canvas")[0];
        this.ctx = this.canvas.getContext("2d") as any;

        // Update canvas sizing
        this.canvas.width = Consts.WIDTH_PX;
        this.canvas.height = Consts.HEIGHT_PX;

        // Disable image smoothing (for pixel art)
        this.ctx.imageSmoothingEnabled = false;

        // Disable context menus
        this.canvas.addEventListener("contextmenu", e => e.preventDefault());

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
            new Fuseman(new Point2(16, 16), 1),
            new Fuseman(new Point2(16 * Consts.TILES_ACROSS, 16 * Consts.TILES_DOWN), 2),
            new Fuseman(new Point2(16 * Consts.TILES_ACROSS, 16), 3),
            new Fuseman(new Point2(16, 16 * Consts.TILES_DOWN), 4),
            new Fuseman(new Point2(16 * Math.ceil(Consts.TILES_ACROSS / 2), 16 * Math.ceil(Consts.TILES_DOWN / 2)), 5)
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

        // Randomly remove between 4 and 9 mutable tiles
        const numMutableTilesToRemove = Math.floor(Math.random() * 5) + 4;
        for (let i = 0; i < numMutableTilesToRemove; ++i) {
            let x: number, y: number;
            do {
                x = Math.floor(Math.random() * tilesAcrossExt);
                y = Math.floor(Math.random() * tilesDownExt);
            } while (this.grid[x][y] === null || !(this.grid[x][y] instanceof MutableTile));

            // Remove this tile
            this.grid[x][y] = null;
        }

        // Add all Mutable Tiles to internal array
        // O(n^2) but only runs once at start
        for (let x = 0; x < this.grid.length; ++x) {
            for (let y = 0; y < this.grid[x].length; ++y) {
                if (this.grid[x][y] instanceof MutableTile) {
                    this.mutableTiles.push( this.grid[x][y] as MutableTile );
                }
            }
        }
    }

    /**
     * Updates the game state for each sprite
     */
    update(dt: number) {
        // 1A. Update Fuseman sprite intents
        this.fusers.forEach(fuseman => fuseman.updateMovementIntent(dt));

        // 1B. Update fuse & blast timers
        this.fuses.forEach(fuse => fuse.tick(dt, this));
        this.blasts.forEach(blast => blast.tick(dt, this));

        // 2A. Check for blast collisions
        // TODO - check for collisions between blasts and fusers/mutable tiles/items/fuses (everything but other blasts and immutable tiles)

        // 2B. Check for Fuser collisions
        // TODO - check for collisions between fusers and tiles/items/fuses (everything but blasts)

        // 3A. Update Fuser positions & execute actions
        this.fusers.forEach(f => f.tick(dt, this));

        // 3B. Update mutable tiles & other tickables
        this.mutableTiles.forEach(mt => mt.tick(dt, this));
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
                const tile = this.grid[x][y];

                // Draw background behind fuses
                if (!tile || !tile.isOpaque()) {
                    this.ctx.drawImage(
                        this.textures.tiles.frames[ this.textures.tiles.backgroundTile[this.themeIndex] ],
                        x * 16, y * 16,
                        16, 16
                    );
                }

                // Draw any filled tiles' Sprites
                if (tile) tile!.draw(this.ctx, this.textures);
            }
        }

        // Draw Fuses & Blasts beneath Fuserman
        this.fuses.forEach(fuse => fuse.draw(this.ctx, this.textures));
        this.blasts.forEach(blasts => blasts.draw(this.ctx, this.textures));

        // Draw Fusers overtop (backwards so player 1 is atop player 2, etc.)
        this.fusers.toReversed().forEach(f => f.draw(this.ctx, this.textures));
    }

    /**
     * Attempts to add a new fuse to the grid & internal array, silently fails (if space occupied)
     */
    attemptPlaceFuse(x: number, y: number, owner: Fuseman, blastRadius: number) {
        // Attempt to place fuse
        if (this.grid[x][y] !== null)
            return;

        // Place fuse
        const fuse = new Fuse( new Point2(x * 16, y * 16), owner, blastRadius );
        this.fuses.push(fuse);
        this.grid[x][y] = fuse;
        owner.decAvailFuses();
    }

    /**
     * Spawns a new blast at the location of a fuse
     */
    spawnBlast(fuse: Fuse, blastRadius: number): void {
        // Allow owner to place more fuses
        fuse.owner.incAvailFuses();

        // Determine grid position
        const x = Math.floor(fuse.pos.x / 16);
        const y = Math.floor(fuse.pos.y / 16);

        // Remove fuse
        this.grid[x][y] = null;
        this.fuses.splice(this.fuses.indexOf(fuse), 1);

        /****** Create blasts ******/

        // Center blast
        this.blasts.push(
            this.grid[x][y] = new Blast( new Point2(x * 16, y * 16), "center", 0 )
        );

        // Spread left
        for (let i = 1; i <= blastRadius; ++i) {
            if (x - i <= 0) break;
            if (this.grid[x - i][y] instanceof MutableTile) {
                (this.grid[x - i][y] as MutableTile).destroy();
                break;
            } else if (this.grid[x - i][y]) {
                break;
            }

            this.blasts.push(
                this.grid[x - i][y] = new Blast(
                    new Point2( (x - i) * 16, y * 16 ),
                    (i === blastRadius) ? "end" : "middle",
                    90
                )
            );
        }

        // Spread right
        for (let i = 1; i <= blastRadius; ++i) {
            if (x + i + 1 === Consts.TILES_ACROSS_EXTERIOR) break;
            if (this.grid[x + i][y] instanceof MutableTile) {
                (this.grid[x + i][y] as MutableTile).destroy();
                break;
            } else if (this.grid[x + i][y]) {
                break;
            }

            this.blasts.push(
                this.grid[x + i][y] = new Blast(
                    new Point2( (x + i) * 16, y * 16 ),
                    (i === blastRadius) ? "end" : "middle",
                    270
                )
            );
        }

        // Spread up
        for (let i = 1; i <= blastRadius; ++i) {
            if (y - i <= 0) break;
            if (this.grid[x][y - i] instanceof MutableTile) {
                (this.grid[x][y - i] as MutableTile).destroy();
                break;
            } else if (this.grid[x][y - i]) {
                break;
            }

            this.blasts.push(
                this.grid[x][y - i] = new Blast(
                    new Point2( x * 16, (y - i) * 16 ),
                    (i === blastRadius) ? "end" : "middle",
                    180
                )
            );
        }

        // Spread down
        for (let i = 1; i <= blastRadius; ++i) {
            if (y + i + 1 === Consts.TILES_DOWN_EXTERIOR) break;
            if (this.grid[x][y + i] instanceof MutableTile) {
                (this.grid[x][y + i] as MutableTile).destroy();
                break;
            } else if (this.grid[x][y + i]) {
                break;
            }

            this.blasts.push(
                this.grid[x][y + i] = new Blast(
                    new Point2( x * 16, (y + i) * 16 ),
                    (i === blastRadius) ? "end" : "middle",
                    0
                )
            );
        }
    }

    /**
     * Removes a blast sprite from the grid & array
     */
    removeBlast(blast: Blast) {
        const x = Math.floor(blast.pos.x / 16);
        const y = Math.floor(blast.pos.y / 16);
        this.grid[x][y] = null;
        this.blasts.splice( this.blasts.indexOf(blast), 1 );
    }

    /**
     * Removes a mutable tile from the grid & array
     */
    removeMutableTile(mutableTile: MutableTile) {
        const x = Math.floor(mutableTile.pos.x / 16);
        const y = Math.floor(mutableTile.pos.y / 16);
        this.grid[x][y] = null;
        this.mutableTiles.splice( this.mutableTiles.indexOf(mutableTile), 1 );
    }

};
