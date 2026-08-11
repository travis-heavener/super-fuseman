import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";

/**
 * The base Tile class.
 * 
 * Binds to the grid, and is either immutable or mutable (can be destroyed).
 */
export default abstract class Tile extends Sprite {
    protected themeIndex: number;

    constructor(pos: Point2, themeIndex: number) {
        super(pos);
        this.themeIndex = themeIndex;
    }

    getBounds(): Point2[] {
        return [
            new Point2(this.pos.x, this.pos.y),
            new Point2(this.pos.x + 16, this.pos.y),
            new Point2(this.pos.x, this.pos.y + 16),
            new Point2(this.pos.x + 16, this.pos.y + 16)
        ];
    }
};
