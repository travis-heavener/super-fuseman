import Textures from "../engine/Textures.mjs";
import Point2 from "../tools/Point2.mjs";

/**
 * Base Sprite class.
 * 
 * All subclasses inherit the draw() method.
*/
export default abstract class Sprite {
    // The position of the Fuseman on the game's position grid
    pos: Point2;

    constructor(pos: Point2) {
        this.pos = pos;
    }

    /**
     * Draws the sprite on the canvas.
     */
    abstract draw(ctx: CanvasRenderingContext2D, textures: Textures): any;
};
