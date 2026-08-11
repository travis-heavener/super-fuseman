import Textures from "../engine/Textures.mjs";
import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Renderer from "../engine/Renderer.mjs";
import Sprite from "./Sprite.mjs";

/**
 * Shorthand type for available blast rendering types
 */
type BlastType = "center" | "middle" | "end";

/**
 * Blasts are spawned when a Fuse detonates, which are what kill Fuseman, mutable tiles, and collectables
 */
export default class Blast extends Sprite {
    // Which model of Blast this is (center/middle/end)
    private type: BlastType;

    // How much time is left before the Blast disappears
    private timer: number;

    // The rotation of the blast texture, in degrees
    private rotation: number;

    constructor(pos: Point2, type: BlastType, rotation: number) {
        super(pos);
        this.type = type;
        this.timer = Consts.BLAST_TIMER_SEC;
        this.rotation = rotation;

        // Disable opacity
        super.disableOpaqueness();
    }

    /**
     * Draws the Blast on the canvas
     */
    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        const blastIndex = Math.min(
            Math.floor( 6 * (Consts.BLAST_TIMER_SEC - this.timer) / Consts.BLAST_TIMER_SEC ),
            textures.tiles.blast[this.type].length - 1
        );
        const frameIndex = textures.tiles.blast[this.type][ blastIndex ];

        // Rotate if needed
        if (this.rotation !== 0) {
            ctx.save();
            ctx.translate(this.pos.x + 8, this.pos.y + 8);
            ctx.rotate(Math.PI * this.rotation / 180);

            // Draw frame
            ctx.drawImage( textures.tiles.frames[ frameIndex ], -8, -8 );

            ctx.restore();
        } else {
            // Draw frame
            ctx.drawImage( textures.tiles.frames[ frameIndex ], this.pos.x, this.pos.y );
        }
    }

    /**
     * Ticks the Fuse closer to explosion
     */
    tick(dt: number, renderer: Renderer) {
        // Check if timer is expired
        if (this.timer <= 0) {
            renderer.removeBlast(this);
            return;
        }
        this.timer -= dt;
    }

    /**
     * Returns slightly smaller bounds for blast tiles
     */
    getBounds(): Point2[] {
        return [
            new Point2(this.pos.x + 1,  this.pos.y + 1),
            new Point2(this.pos.x + 15, this.pos.y + 1),
            new Point2(this.pos.x + 1,  this.pos.y + 15),
            new Point2(this.pos.x + 15, this.pos.y + 15)
        ];
    }
};
