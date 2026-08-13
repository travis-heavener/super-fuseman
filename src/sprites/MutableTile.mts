import Renderer from "../engine/Renderer.mjs";
import Textures from "../engine/Textures.mjs";
import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Tile from "./Tile.mjs";

/**
 * Mutable Tiles are Tiles which can be destroyed by fuses.
 */
export default class MutableTile extends Tile {
    // How much time is left before the MutableTile disappears, or -Infinity if not started
    private timer: number;

    // Whether or not to create a Collectible and destroy self on next tick
    private spawnCollectibleOnNextTick: boolean;

    constructor(pos: Point2, themeIndex: number) {
        super(pos, themeIndex);
        this.timer = -Infinity;
        this.spawnCollectibleOnNextTick = false;
    }

    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        if ( !isFinite(this.timer) ) {
            // Draw base texture
            ctx.drawImage(
                textures.tiles.frames[ textures.tiles.mutableTile[ this.themeIndex ] ], this.pos.x, this.pos.y
            );
        } else {
            // Draw animated crumble texture
            const crumbleIndex = Math.min(
                Math.floor( 3 * (Consts.TILE_CRUMBLE_TIMER_SEC - this.timer) / Consts.TILE_CRUMBLE_TIMER_SEC ),
                textures.tiles.mutableTileCrumbling[ this.themeIndex ].length - 1
            );
            const frameIndex = textures.tiles.mutableTileCrumbling[ this.themeIndex ][ crumbleIndex ];

            // Draw frame
            ctx.drawImage( textures.tiles.frames[ frameIndex ], this.pos.x, this.pos.y);
        }
    }

    /**
     * Handle destruction animation
     */
    tick(dt: number, renderer: Renderer) {
        // Check if this is destroyed
        if (this.spawnCollectibleOnNextTick) {
            // Generate Collectible
            renderer.generateCollectibleAtTile(this);
            return;
        } else if (this.timer <= 0 && isFinite(this.timer)) {
            renderer.removeMutableTile(this);
            return;
        } else if (isFinite(this.timer)) {
            this.timer -= dt;
        }
    }

    /**
     * Marks the current tile to be destroyed after a short animation
     */
    destroy() {
        // Determine whether or not to spawn a Collectible
        if (Math.random() < Consts.COLLECTIBLE_SPAWN_RATE) {
            // Mark for Collectible spawn on next tick
            this.spawnCollectibleOnNextTick = true;
            return;
        }

        // Otherwise, draw crumble animation
        this.timer = Consts.TILE_CRUMBLE_TIMER_SEC;

        // Disable opaqueness to paint background beneath
        super.disableOpaqueness();
    }
};
