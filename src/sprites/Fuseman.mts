import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";
import Textures from "../engine/Textures.mjs";
import Tickable from "./Tickable.mjs";

/**
 * Type wrapper for movement intent, determined before collision checks and is reset each tick
 */
type MovementIntent = {
    direction: "left" | "right" | "up" | "down",
    endPos: Point2,
    isMoving: boolean
};

/**
 * The base Fuseman class, the character sprite which places fuses and detonates breakable tiles.
 */
export default class Fuseman extends Sprite implements Tickable {
    // Which player this is, from 1 to 5
    playerNumber: number;

    // The direction the Fuseman is facing
    direction: "left" | "right" | "up" | "down";

    isMoving: boolean; // Whether or not the Fuseman is moving (for animations)
    isDying: boolean; // Whether or not the death animation is playing
    isDead: boolean; // Whether or not the Fuseman can be controlled, can interact, etc.

    // The current animation frame index, resets to 0 when changing directions
    animFrameIndex: number;

    // Timestamp of last animation frame update
    lastAnimationFrameTimestamp: number;

    // Stores the last movement intent pre-collision check for a tick
    private currentIntent: MovementIntent;

    constructor(pos: Point2, playerNumber: number) {
        super(pos);

        // Player number, 1-5
        this.playerNumber = playerNumber;

        // Initializing to down makes the Fuseman face the player
        this.direction = "down";

        // Reset animation flags
        this.animFrameIndex = this.lastAnimationFrameTimestamp = 0;
        this.isMoving = this.isDying = this.isDead = false;
        this.currentIntent = {} as MovementIntent;
    }

    /**
     * Initiates the demise of Fuseman
     */
    private startDeath() {
        this.isDying = true;
        this.isMoving = false;
        this.animFrameIndex = 0;
    }

    /**
     * Ends the demise of Fuseman
     */
    private finishDeath() {
        this.isDead = true;
        this.isDying = false;
    }

    /**
     * Draws the Fuseman on the canvas.
     */
    draw(ctx: CanvasRenderingContext2D, textures: Textures) {
        if (this.isDead) return;

        // Draw Fuseman's shadow
        const shadowFrameIndex = textures.fusers[this.playerNumber - 1].shadow;
        ctx.drawImage(
            textures.fusers[this.playerNumber - 1].frames[ shadowFrameIndex ], this.pos.x, this.pos.y - 16
        );

        // Handle dying Fuseman
        if (this.isDying) {
            const sheetFrameIndex = textures.fusers[this.playerNumber - 1].die[this.animFrameIndex];
            const numFrames = textures.fusers[this.playerNumber - 1].die.length;

            // Draw frame
            ctx.drawImage(textures.fusers[this.playerNumber - 1].frames[sheetFrameIndex], this.pos.x, this.pos.y - 16);

            // Cycle to next animation frame, if needed
            if (this.animFrameIndex + 1 === numFrames) {
                this.finishDeath();
            } else if (Date.now() - this.lastAnimationFrameTimestamp > Consts.ANIMATION_FRAME_INTERVAL_MS) {
                this.animFrameIndex = (this.animFrameIndex + 1) % numFrames;
                this.lastAnimationFrameTimestamp = Date.now();
            }
        } else if (this.isMoving) {
            let numFrames: number; // Total number of frames for this animation
            let sheetFrameIndex: number; // Current frame index from the array of frames on spritesheet

            // Draw animated pose (shift up 16px for overdraw)
            switch (this.direction) {
                case "up":
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveUp[this.animFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveUp.length;
                    break;
                case "down":
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveDown[this.animFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveDown.length;
                    break;
                case "right":
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveRight[this.animFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveRight.length;
                    break;
                case "left":
                    sheetFrameIndex = textures.fusers[this.playerNumber - 1].moveLeft[this.animFrameIndex];
                    numFrames = textures.fusers[this.playerNumber - 1].moveLeft.length;
                    break;
            }

            // Draw frame
            ctx.drawImage(textures.fusers[this.playerNumber - 1].frames[sheetFrameIndex], this.pos.x, this.pos.y - 16);

            // Cycle to next animation frame, if needed
            if (Date.now() - this.lastAnimationFrameTimestamp > Consts.ANIMATION_FRAME_INTERVAL_MS) {
                this.animFrameIndex = (this.animFrameIndex + 1) % numFrames;
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

    /**
     * Checks for movement intent before checking collisions or moving
     */
    updateMovementIntent(dt: number): void {
        if (this.isDead) return;

        this.currentIntent = {
            "direction": "down", // Default pose
            "endPos": new Point2(this.pos.x, this.pos.y),
            "isMoving": false
        } as MovementIntent;

        // Check for key press
        if (this.playerNumber === 1) {
            // Lock currently held keys & look for most recently pressed movement key
            const keysHeld = [...globalThis.keysHeld];
            for (let i = keysHeld.length; !this.currentIntent.isMoving && i >= 0; --i) {
                switch (keysHeld[i]) {
                    case Consts.KEYS.LEFT:
                        if (keysHeld.includes( Consts.KEYS.RIGHT )) break;
                        this.currentIntent.direction = "left";
                        this.currentIntent.isMoving = true;
                        this.currentIntent.endPos.x -= Consts.FUSEMAN_SPEED_PX_PER_SEC * dt;
                        break;
                    case Consts.KEYS.RIGHT:
                        if (keysHeld.includes( Consts.KEYS.LEFT )) break;
                        this.currentIntent.direction = "right";
                        this.currentIntent.isMoving = true;
                        this.currentIntent.endPos.x += Consts.FUSEMAN_SPEED_PX_PER_SEC * dt;
                        break;
                    case Consts.KEYS.DOWN:
                        if (keysHeld.includes( Consts.KEYS.UP )) break;
                        this.currentIntent.direction = "down";
                        this.currentIntent.isMoving = true;
                        this.currentIntent.endPos.y += Consts.FUSEMAN_SPEED_PX_PER_SEC * dt;
                        break;
                    case Consts.KEYS.UP:
                        if (keysHeld.includes( Consts.KEYS.DOWN )) break;
                        this.currentIntent.direction = "up";
                        this.currentIntent.isMoving = true;
                        this.currentIntent.endPos.y -= Consts.FUSEMAN_SPEED_PX_PER_SEC * dt;
                        break;
                }
            }

            // TODO - handle planting
        }
    }

    /**
     * Updates the Fuseman's position, including processing any key input
     */
    tick(dt: number) {
        if (this.isDead || this.isDying) return;

        // Handle updates from last intent
        this.isMoving = this.currentIntent.isMoving;
        this.direction = this.currentIntent.direction;

        // Move from last intent
        if (this.isMoving) {
            this.pos.x = this.currentIntent.endPos.x;
            this.pos.y = this.currentIntent.endPos.y;
        }
    }
};
