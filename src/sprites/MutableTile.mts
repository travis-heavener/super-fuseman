import Renderer from "../engine/Renderer.mjs";
import Textures from "../engine/Textures.mjs";
import Point2 from "../tools/Point2.mjs";
import Tickable from "./Tickable.mjs";
import Tile from "./Tile.mjs";

/**
 * Mutable Tiles are Tiles which can be destroyed by fuses.
 */
export default class MutableTile extends Tile implements Tickable {
    constructor(pos: Point2, themeIndex: number) {
        super(pos, themeIndex);
    }

    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        ctx.drawImage(
            textures.tiles.frames[ textures.tiles.mutableTile[ this.themeIndex ] ], this.pos.x, this.pos.y
        );
    }

    /**
     * Handle destruction animation
     */
    tick(dt: number, renderer: Renderer) {
        // TODO
    }
};
