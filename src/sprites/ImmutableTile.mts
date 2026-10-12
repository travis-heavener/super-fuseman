import Textures from "../engine/Textures.mjs";
import Point2 from "../tools/Point2.mjs";
import Tile from "./Tile.mjs";
import Consts from "../tools/Consts.mjs";

/**
 * Immutable Tiles are Tiles which *cannot* be destroyed by fuses.
 */
export default class ImmutableTile extends Tile {
    // Time remaining for the sudden-death drop animation
    private dropTimer: number;

    constructor(pos: Point2, themeIndex: number, isDropping: boolean = false) {
        super(pos, themeIndex);
        this.dropTimer = isDropping ? Consts.SUDDEN_DEATH_TILE_DROP_SEC : 0;
    }

    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        // Drop into place from above, then leave the tile fixed in the grid
        const offset = Math.ceil(12 * this.dropTimer / Consts.SUDDEN_DEATH_TILE_DROP_SEC);
        ctx.drawImage(
            textures.tiles.frames[ textures.tiles.immutableTile[ this.themeIndex ] ], this.pos.x, this.pos.y - offset
        );
    }

    /**
     * Advances the landing animation for a newly placed immutable tile
     */
    tick(dt: number): void {
        this.dropTimer = Math.max(0, this.dropTimer - dt);
    }

    /**
     * Returns true while this tile is still falling into place
     */
    isDropping(): boolean {
        return this.dropTimer > 0;
    }
};
