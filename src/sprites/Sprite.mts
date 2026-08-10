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

    // Whether or not the sprite is opaque (doesn't need background drawn behind it)
    private _isOpaque: boolean;

    constructor(pos: Point2) {
        this.pos = pos;
        this._isOpaque = true;
    }

    /**
     * Draws the sprite on the canvas.
     */
    abstract draw(ctx: CanvasRenderingContext2D, textures: Textures): any;

    /**
     * Allows for drawing the background behind this sprite
     */
    disableOpaqueness(): void {
        this._isOpaque = false;
    }

    /**
     * Whether or not the sprite is opaque
     */
    isOpaque() {
        return this._isOpaque;
    }
};
