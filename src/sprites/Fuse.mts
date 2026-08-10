import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";
import Textures from "../engine/Textures.mjs";
import Renderer from "../engine/Renderer.mjs";
import Fuseman from "./Fuseman.mjs";

/**
 * Fuses are placeable items that explode and spawn Blast sprites,
 *  which kill Fuseman, other collectable items, and mutable tiles
 */
export default class Fuse extends Sprite {
    // The owner Fuseman of this fuse
    owner: Fuseman;

    // The blast radius of the fuse
    private blastRadius: number;

    // How much time is left before the Fuse explodes
    private timer: number;

    // Whether or not the current animation frame is the larger of the two
    private isShowingLargerVariant: boolean;

    // Timestamp of last animation frame update
    private lastAnimationFrameTimestamp: number;

    constructor(pos: Point2, owner: Fuseman, blastRadius: number) {
        super(pos);

        // Init fields
        this.owner = owner;
        this.timer = Consts.FUSE_TIMER_SEC;
        this.isShowingLargerVariant = true;
        this.lastAnimationFrameTimestamp = 0;
        this.blastRadius = blastRadius;
    }

    /**
     * Draws the Fuse on the canvas
     */
    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        const timerThird = Consts.FUSE_TIMER_SEC / 3;
        let frameIndex: number;

        if (this.timer > timerThird * 2) { // First phase
            frameIndex = textures.tiles.fuse[ this.isShowingLargerVariant ? 0 : 1 ];
        } else if (this.timer > timerThird) { // Second phase
            frameIndex = textures.tiles.fuse[ this.isShowingLargerVariant ? 2 : 3 ];
        } else { // Last phase
            frameIndex = textures.tiles.fuse[ this.isShowingLargerVariant ? 4 : 5 ];
        }

        // Draw frame
        ctx.drawImage( textures.tiles.frames[ frameIndex ], this.pos.x, this.pos.y );

        // Cycle to next animation frame, if needed
        if (Date.now() - this.lastAnimationFrameTimestamp > Consts.ANIMATION_FRAME_INTERVAL_MS * 2) {
            // Flip variant
            this.isShowingLargerVariant = !this.isShowingLargerVariant;
            this.lastAnimationFrameTimestamp = Date.now();
        }
    }

    /**
     * Ticks the Fuse closer to explosion
     */
    tick(dt: number, renderer: Renderer) {
        // Check if timer is expired
        if (this.timer <= 0) {
            renderer.spawnBlast(this, this.blastRadius);
            return;
        }
        this.timer -= dt;
    }
};
