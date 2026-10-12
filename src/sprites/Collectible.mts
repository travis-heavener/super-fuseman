import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";
import Textures from "../engine/Textures.mjs";
import Renderer from "../engine/Renderer.mjs";
import Consts from "../tools/Consts.mjs";

// Enum of all possible variants
export enum Variant {
    EXTRA_FUSE,
    LARGER_BLASTS,
    SPEED_BOOST,
    SMALL_BLASTS,
    FLIPPED_CONTROLS,
    NO_FUSES,
    __LENGTH
};

// Maps Variant types to their textures
const getTextureOffsetFromVariant = (variant: Variant) => {
    switch (variant) {
        case Variant.EXTRA_FUSE: return 1;
        case Variant.LARGER_BLASTS: return 2;

        // For mystery collectibles
        default: return 3;
    }
};

/**
 * Collectible & power-up class that extends the Sprite base class
 */
export default class Collectible extends Sprite {
    // How much time is left before the MutableTile disappears, or -Infinity if not started
    private timer: number;

    // Which type of Collectible this is
    variant: Variant;

    constructor(pos: Point2, variant: Variant = Math.floor(Math.random() * Variant.__LENGTH)) {
        super(pos);
        this.timer = -Infinity;
        this.variant = variant;
    }

    /**
     * Draws the Collectible and its background
     */
    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        if ( !isFinite(this.timer) ) { // Draw normal texture
            const baseFrameIndex = textures.tiles.collectible[0];

            // Draw background
            ctx.drawImage( textures.tiles.frames[baseFrameIndex], this.pos.x, this.pos.y );

            // Draw variant icon
            ctx.drawImage( textures.tiles.frames[baseFrameIndex + getTextureOffsetFromVariant(this.variant)], this.pos.x, this.pos.y );
        } else { // Draw destruction animation
            // Actually just a 180-degree rotated end blast texture
            const blastIndex = Math.min(
                Math.floor( 6 * (Consts.COLLECTIBLE_DESTROY_TIMER_SEC - this.timer) / Consts.COLLECTIBLE_DESTROY_TIMER_SEC ),
                textures.tiles.blast.end.length - 1
            );
            const frameIndex = textures.tiles.blast.end[ blastIndex ];
    
            // Rotate canvas 180 degrees
            ctx.save();
            ctx.translate(this.pos.x + 8, this.pos.y + 8);
            ctx.rotate(Math.PI);

            // Draw frame
            ctx.drawImage( textures.tiles.frames[ frameIndex ], -8, -8 );

            ctx.restore();
        }
    }

    /**
     * Returns the bounds of the Collectible
     */
    getBounds(): Point2[] {
        return [
            new Point2(this.pos.x, this.pos.y),
            new Point2(this.pos.x + 16, this.pos.y),
            new Point2(this.pos.x, this.pos.y + 16),
            new Point2(this.pos.x + 16, this.pos.y + 16)
        ];
    }

    /**
     * Handle destruction animation
     */
    tick(dt: number, renderer: Renderer) {
        // Check if this is destroyed
        if (this.timer <= 0 && isFinite(this.timer)) {
            renderer.removeCollectible(this);
            return;
        }
        this.timer -= dt;
    }

    /**
     * Marks the current tile to be destroyed after a short animation
     */
    destroy() {
        this.timer = Consts.COLLECTIBLE_DESTROY_TIMER_SEC;

        // Disable opaqueness to paint background beneath
        super.disableOpaqueness();
    }

    /**
     * Returns true if this is not being destroyed
     */
    isCollectible(): boolean {
        return !isFinite(this.timer);
    }
};
