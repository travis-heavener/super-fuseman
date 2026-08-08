import Textures from "../engine/Textures.mjs";
import Point2 from "../tools/Point2.mjs";
import Tile from "./Tile.mjs";

/**
 * Immutable Tiles are Tiles which *cannot* be destroyed by fuses.
 */
export default class ImmutableTile extends Tile {
    constructor(pos: Point2) {
        super(pos);
    }

    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        ctx.drawImage(
            textures.tiles.frames[ textures.tiles.immutableTile ], this.pos.x, this.pos.y
        );
    }
};
