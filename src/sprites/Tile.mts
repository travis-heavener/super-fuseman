import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";

/**
 * The base Tile class.
 * 
 * Binds to the grid, and is either immutable or mutable (can be destroyed).
 */
export default abstract class Tile extends Sprite {
    constructor(pos: Point2) {
        super(pos);
    }
};
