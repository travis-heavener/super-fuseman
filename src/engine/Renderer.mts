import Consts from "../tools/Consts.mjs";
import Blast from "../sprites/Blast.mjs";
import Collectible, { Variant } from "../sprites/Collectible.mjs";
import Fuse from "../sprites/Fuse.mjs";
import Fuseman from "../sprites/Fuseman.mjs";
import Textures from "./Textures.mjs";
import Sprite from "../sprites/Sprite.mjs";
import ImmutableTile from "../sprites/ImmutableTile.mjs";
import MutableTile from "../sprites/MutableTile.mjs";
import Point2 from "../tools/Point2.mjs";

/**
 * The result of a finished match
 */
export type MatchResult = {
    // "win" if one Fuseman remains, "draw" if none do
    outcome: "win" | "draw";
    winner?: number;
};

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
    private collectibles: Collectible[];
    private grid: (Sprite | null)[][];

    // The ordered interior tiles and landing animations for sudden death
    private closingTiles: Point2[];
    private fallingTiles: ImmutableTile[];
    private closingTileIndex: number;
    private matchTime: number;

    private textures: Textures;
    private themeIndex: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private constructor(textures: Textures) {
        this.fusers = [];
        this.mutableTiles = [];
        this.fuses = [];
        this.blasts = [];
        this.collectibles = [];
        this.grid = [];
        this.closingTiles = [];
        this.fallingTiles = [];
        this.closingTileIndex = 0;
        this.matchTime = 0;
        this.themeIndex = 0;

        this.canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
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

        // Set up the first match
        this.reset();
    }

    static async create() {
        return new Renderer( await Textures.create() );
    }

    /**
     * Clears all sprites and sets up a fresh match
     */
    reset() {
        // Clear all sprites
        this.fusers.length = 0;
        this.mutableTiles.length = 0;
        this.fuses.length = 0;
        this.blasts.length = 0;
        this.collectibles.length = 0;
        this.fallingTiles.length = 0;
        this.closingTileIndex = 0;
        this.matchTime = 0;

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
        this.createClosingRoute();
    }

    /**
     * Orders each interior ring clockwise, working from the outer edge inward
     */
    private createClosingRoute() {
        this.closingTiles = [];
        for (let inset = 1; inset <= Math.ceil(Math.min(Consts.TILES_ACROSS, Consts.TILES_DOWN) / 2); ++inset) {
            const left = inset;
            const right = Consts.TILES_ACROSS_EXTERIOR - 1 - inset;
            const top = inset;
            const bottom = Consts.TILES_DOWN_EXTERIOR - 1 - inset;
            if (left > right || top > bottom) break;

            // Walk all four sides without repeating their corner tiles
            for (let x = left; x <= right; ++x) this.closingTiles.push(new Point2(x, top));
            for (let y = top + 1; y <= bottom; ++y) this.closingTiles.push(new Point2(right, y));
            if (bottom > top)
                for (let x = right - 1; x >= left; --x) this.closingTiles.push(new Point2(x, bottom));
            if (left < right)
                for (let y = bottom - 1; y > top; --y) this.closingTiles.push(new Point2(left, y));
        }
    }

    /**
     * Creates sprites at the start of each match
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
        this.fusers.forEach(fuseman => fuseman.updateMovementIntent(dt, this));

        // 1B. Update fuse & blast timers
        this.fuses.forEach(fuse => fuse.tick(dt, this));
        this.blasts.forEach(blast => blast.tick(dt, this));

        // 2A. Check for Fuser collisions
        this.fusers.forEach(fuseman => fuseman.resolveCollisions(this));

        // 3A. Update Fuser positions & execute actions
        this.fusers.forEach(f => f.tick(dt, this));

        // 3B. Update mutable tiles & other tickables
        this.mutableTiles.forEach(mt => mt.tick(dt, this));
        this.collectibles.forEach(c => c.tick(dt, this));

        // 4. Exchange mystery power-ups between Fusemen that touch
        for (let i = 0; i < this.fusers.length; ++i)
            for (let j = i + 1; j < this.fusers.length; ++j)
                this.fusers[i].resolveTouch(this.fusers[j]);

        // 5. Close the arena tile by tile after the sudden-death delay
        this.matchTime += dt;
        this.fallingTiles.forEach(tile => tile.tick(dt));
        this.fallingTiles = this.fallingTiles.filter(tile => tile.isDropping());
        while (this.closingTileIndex < this.closingTiles.length && this.matchTime >=
            Consts.SUDDEN_DEATH_DELAY_SEC + this.closingTileIndex * Consts.SUDDEN_DEATH_TILE_INTERVAL_SEC) {
            this.placeClosingTile(this.closingTiles[this.closingTileIndex++]);
        }
    }

    /**
     * Returns a short warning shortly before and after the arena begins closing
     */
    getSuddenDeathWarning(): string | null {
        if (this.matchTime >= Consts.SUDDEN_DEATH_DELAY_SEC - Consts.SUDDEN_DEATH_WARNING_SEC &&
            this.matchTime < Consts.SUDDEN_DEATH_DELAY_SEC) return "ARENA CLOSING SOON";
        if (this.matchTime >= Consts.SUDDEN_DEATH_DELAY_SEC &&
            this.matchTime < Consts.SUDDEN_DEATH_DELAY_SEC + 2) return "SUDDEN DEATH";
        return null;
    }

    /**
     * Returns elapsed match time for the clock above the arena
     */
    getMatchTime(): number {
        return this.matchTime;
    }

    /**
     * Returns a player's idle sprite frame for the wins display
     */
    getPlayerPortrait(playerNumber: number): ImageBitmap {
        const sprites = this.textures.fusers[playerNumber - 1];
        return sprites.frames[sprites.idle];
    }

    /**
     * Replaces a grid occupant with an immutable tile and crushes anyone it touches
     */
    private placeClosingTile(tile: Point2) {
        const x = tile.x;
        const y = tile.y;
        const occupant = this.grid[x][y];
        if (occupant instanceof ImmutableTile) return;

        // Remove the old sprite from its timer array before replacing its grid cell
        if (occupant instanceof Fuse) {
            this.fuses.splice(this.fuses.indexOf(occupant), 1);
            occupant.owner.incAvailFuses();
        } else if (occupant instanceof Blast) {
            this.blasts.splice(this.blasts.indexOf(occupant), 1);
        } else if (occupant instanceof MutableTile) {
            this.mutableTiles.splice(this.mutableTiles.indexOf(occupant), 1);
        } else if (occupant instanceof Collectible) {
            this.collectibles.splice(this.collectibles.indexOf(occupant), 1);
        }

        // Block the cell immediately; the tile artwork drops into place over a few frames
        const pos = new Point2(x * 16, y * 16);
        const fallingTile = new ImmutableTile(pos, this.themeIndex, true);
        this.grid[x][y] = fallingTile;
        this.fallingTiles.push(fallingTile);

        // A player straddling the closing cell is caught even if their origin is elsewhere
        for (const fuseman of this.fusers) {
            if (fuseman.pos.x < pos.x + 16 && fuseman.pos.x + 16 > pos.x &&
                fuseman.pos.y < pos.y + 16 && fuseman.pos.y + 16 > pos.y) fuseman.crush(this);
        }
    }

    /**
     * Returns the result of the match if it has ended, otherwise null
     * 
     * The match ends when one or fewer Fusemen remain, even if the human player died earlier.
     */
    getMatchResult(): MatchResult | null {
        // Let any death animations finish first
        if (this.fusers.some(f => f.isDeathAnimating())) return null;

        // Check for a last Fuseman standing (or nobody)
        const alive = this.fusers.filter(f => f.isAlive());
        if (alive.length === 1) return { "outcome": "win", "winner": alive[0].playerNumber };
        if (alive.length === 0) return { "outcome": "draw" };

        return null;
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
                if (!tile || !tile.isOpaque() || (tile instanceof ImmutableTile && tile.isDropping())) {
                    this.ctx.drawImage(
                        this.textures.tiles.frames[ this.textures.tiles.backgroundTile[this.themeIndex] ],
                        x * 16, y * 16,
                        16, 16
                    );
                }

                // Draw filled tiles, saving falling ones to land over the players
                if (tile && !(tile instanceof ImmutableTile && tile.isDropping()))
                    tile.draw(this.ctx, this.textures);
            }
        }

        // Draw Fuses, Blasts, and Collectibles beneath Fuserman
        this.fuses.forEach(fuse => fuse.draw(this.ctx, this.textures));
        this.blasts.forEach(blasts => blasts.draw(this.ctx, this.textures));
        this.collectibles.forEach(collectible => collectible.draw(this.ctx, this.textures));

        // Draw Fusers overtop (backwards so player 1 is atop player 2, etc.)
        this.fusers.toReversed().forEach(f => f.draw(this.ctx, this.textures));

        // Draw incoming sudden-death tiles above any player caught beneath them
        this.fallingTiles.forEach(tile => tile.draw(this.ctx, this.textures));
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
        globalThis.playSound("place_fuse", 0.75);
    }

    /**
     * Spawns a new blast at the location of a fuse
     */
    spawnBlast(fuse: Fuse, blastRadius: number): void {
        // Allow owner to place more fuses
        fuse.owner.incAvailFuses();
        globalThis.playSound("explosion", 0.5);

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

        // Helper for ending blast searching, returns true if the blast can keep spreading
        const spreadToGridPos = (x: number, y: number): boolean => {
            if (this.grid[x][y] instanceof MutableTile) {
                (this.grid[x][y] as MutableTile).destroy();
                return false;
            } else if (this.grid[x][y] instanceof Collectible) {
                (this.grid[x][y] as Collectible).destroy();
                return false;
            } else if (this.grid[x][y] instanceof Fuse) {
                (this.grid[x][y] as Fuse).triggerBlast();
                return false;
            } else if (this.grid[x][y]) {
                return false;
            }

            // Otherwise, spot is valid
            return true;
        };

        // Spread left
        for (let i = 1; i <= blastRadius; ++i) {
            if (x - i <= 0 || !spreadToGridPos(x - i, y)) break;
            this.blasts.push(
                this.grid[x - i][y] = new Blast(
                    new Point2( (x - i) * 16, y * 16 ), (i === blastRadius) ? "end" : "middle", 90
                )
            );
        }

        // Spread right
        for (let i = 1; i <= blastRadius; ++i) {
            if (x + i + 1 === Consts.TILES_ACROSS_EXTERIOR || !spreadToGridPos(x + i, y)) break;
            this.blasts.push(
                this.grid[x + i][y] = new Blast(
                    new Point2( (x + i) * 16, y * 16 ), (i === blastRadius) ? "end" : "middle", 270
                )
            );
        }

        // Spread up
        for (let i = 1; i <= blastRadius; ++i) {
            if (y - i <= 0 || !spreadToGridPos(x, y - i)) break;
            this.blasts.push(
                this.grid[x][y - i] = new Blast(
                    new Point2( x * 16, (y - i) * 16 ), (i === blastRadius) ? "end" : "middle", 180
                )
            );
        }

        // Spread down
        for (let i = 1; i <= blastRadius; ++i) {
            if (y + i + 1 === Consts.TILES_DOWN_EXTERIOR || !spreadToGridPos(x, y + i)) break;
            this.blasts.push(
                this.grid[x][y + i] = new Blast(
                    new Point2( x * 16, (y + i) * 16 ), (i === blastRadius) ? "end" : "middle", 0
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

    /**
     * Removes a collectible from the grid & array
     */
    removeCollectible(collectible: Collectible) {
        const x = Math.floor(collectible.pos.x / 16);
        const y = Math.floor(collectible.pos.y / 16);
        this.grid[x][y] = null;
        this.collectibles.splice( this.collectibles.indexOf(collectible), 1 );
    }

    /**
     * Scatters a fallen Fuseman's acquired power-ups onto nearby empty tiles
     */
    scatterCollectibles(pos: Point2, variants: Variant[]) {
        if (variants.length === 0) return;

        // Sort open spaces by distance from the fallen player, randomizing ties
        const x = Math.round(pos.x / 16);
        const y = Math.round(pos.y / 16);
        const spaces: { x: number, y: number, distance: number }[] = [];
        for (let tileX = 1; tileX < Consts.TILES_ACROSS_EXTERIOR - 1; ++tileX) {
            for (let tileY = 1; tileY < Consts.TILES_DOWN_EXTERIOR - 1; ++tileY) {
                if (this.grid[tileX][tileY] !== null || this.fusers.some(f => f.isAlive() &&
                    Math.round(f.pos.x / 16) === tileX && Math.round(f.pos.y / 16) === tileY)) continue;
                spaces.push({ "x": tileX, "y": tileY,
                    "distance": Math.abs(tileX - x) + Math.abs(tileY - y) + Math.random() * 0.5 });
            }
        }
        spaces.sort((a, b) => a.distance - b.distance);

        // Keep the exact variants collected, with one item per available tile
        for (const variant of variants) {
            const space = spaces.shift();
            if (!space) break;
            const collectible = new Collectible(new Point2(space.x * 16, space.y * 16), variant);
            this.collectibles.push(collectible);
            this.grid[space.x][space.y] = collectible;
        }
    }

    /**
     * Replaces a mutable tile with a collectible
     */
    generateCollectibleAtTile(mutableTile: MutableTile) {
        // Remove mutable tile
        const pos = mutableTile.pos.copy();
        const x = Math.floor(mutableTile.pos.x / 16);
        const y = Math.floor(mutableTile.pos.y / 16);
        this.mutableTiles.splice( this.mutableTiles.indexOf(mutableTile), 1 );

        // Replace with a collectible
        this.collectibles.push( this.grid[x][y] = new Collectible( pos ) );
    }

    /**
     * Returns a sprite located at a tile at a grid x,y pair
     */
    getSpriteFromGrid(x: number, y: number): Sprite | null {
        return this.grid[x][y];
    }

    /**
     * Returns placed fuses for NPC danger prediction
     */
    getFuses(): readonly Fuse[] {
        return this.fuses;
    }

    /**
     * Returns the Fusemen in this match for NPC opponent tracking
     */
    getFusers(): readonly Fuseman[] {
        return this.fusers;
    }

};
