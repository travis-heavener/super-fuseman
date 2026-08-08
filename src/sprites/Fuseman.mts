import Textures from "../engine/Textures.mjs";
import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";

/**
 * The base Fuseman class, the character sprite which places fuses and detonates breakable tiles.
 */
export default class Fuseman extends Sprite {
    // Which player this is, from 1 to 5
    playerNumber: number;

    // The direction the Fuseman is facing
    direction: "left" | "right" | "up" | "down";

    // Whether or not the Fuseman is moving
    isMoving: boolean;

    // The current animation frame index, resets to 0 when changing directions
    animationFrameIndex: number;

    // Timestamp of last animation frame update
    lastAnimationFrameTimestamp: number;

    constructor(pos: Point2, playerNumber: number) {
        super(pos);

        // Player number, 1-5
        this.playerNumber = playerNumber;

        // Initializing to down makes the Fuseman face the player
        this.direction = "down";

        // Reset animation flags
        this.animationFrameIndex = this.lastAnimationFrameTimestamp = 0;
        this.isMoving = false;
    }

    /**
     * Draws the Fuseman on the canvas.
     */
    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        if (this.isMoving) {
            let numFrames: number; // Total number of frames for this animation
            let sheetFrameIndex: number; // Current frame index from the array of frames on spritesheet

            // Draw animated pose (shift up 16px for overdraw)
            switch (this.direction) {
                case "up": {
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveUp[this.animationFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveUp.length;
                    break;
                }
                case "down": {
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveDown[this.animationFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveDown.length;
                    break;
                }
                case "right": {
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveRight[this.animationFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveRight.length;
                    break;
                }
                case "left": {
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveLeft[this.animationFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveLeft.length;
                    break;
                }
            }

            // Draw frame
            ctx.drawImage(textures.fusers[this.playerNumber - 1].frames[sheetFrameIndex], this.pos.x, this.pos.y - 16);

            // Cycle to next animation frame, if needed
            if (Date.now() - this.lastAnimationFrameTimestamp > Consts.ANIMATION_FRAME_INTERVAL_MS) {
                this.animationFrameIndex = (this.animationFrameIndex + 1) % numFrames;
                this.lastAnimationFrameTimestamp = Date.now();
            }
        } else {
            // Current frame index from the array of frames on spritesheet
            const sheetFrameIndex = textures.fusers[this.playerNumber - 1].idle;

            // Draw idle pose (shift up 16px for overdraw)
            ctx.drawImage(
                textures.fusers[this.playerNumber - 1].frames[ sheetFrameIndex ], this.pos.x, this.pos.y - 16
            );
        }
    }
};
