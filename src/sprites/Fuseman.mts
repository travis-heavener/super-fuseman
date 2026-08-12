import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";
import Textures from "../engine/Textures.mjs";
import Renderer from "../engine/Renderer.mjs";
import Tile from "./Tile.mjs";
import Blast from "./Blast.mjs";

/**
 * Type wrapper for movement intent, determined before collision checks and is reset each tick
 */
type ActionIntent = {
    type: "movement" | "placingFuse";
    direction?: "left" | "right" | "down" | "up";
    endPos?: Point2
};

/**
 * Stats for Fuseman, including power-ups and blast radius
 */
type FusemanStats = {
    // The blast radius of all fuses placed by this Fuseman (doesn't affect already placed ones)
    blastRadius: number,

    // The total number of fuses
    numTotalFuses: number,

    // The number of available fuses
    numAvailFuses: number
};

/**
 * The base Fuseman class, the character sprite which places fuses and detonates breakable tiles.
 */
export default class Fuseman extends Sprite {
    // Which player this is, from 1 to 5
    playerNumber: number;

    // The direction the Fuseman is facing
    private direction: "left" | "right" | "up" | "down";

    private isMoving: boolean; // Whether or not the Fuseman is moving (for animations)
    private isDying: boolean; // Whether or not the death animation is playing
    private isDead: boolean; // Whether or not the Fuseman can be controlled, can interact, etc.

    // The current animation frame index, resets to 0 when changing directions
    private animFrameIndex: number;

    // Timestamp of last animation frame update
    private lastAnimationFrameTimestamp: number;

    // Stores current action intents pre-collision check per tick
    private currentIntents: ActionIntent[];

    // Fuseman's stats including blast radius, number of fuses, etc.
    private stats: FusemanStats;

    constructor(pos: Point2, playerNumber: number) {
        super(pos);

        // Player number, 1-5
        this.playerNumber = playerNumber;

        // Initializing to down makes the Fuseman face the player
        this.direction = "down";

        // Reset animation flags
        this.animFrameIndex = this.lastAnimationFrameTimestamp = 0;
        this.isMoving = this.isDying = this.isDead = false;
        this.currentIntents = [] as ActionIntent[];

        // Init Fuseman stats
        this.stats = {} as FusemanStats;
        Object.assign(this.stats, {
            "blastRadius": 2,
            "numTotalFuses": 1,
            "numAvailFuses": 1
        } as FusemanStats);

        // Disable opacity
        super.disableOpaqueness();
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

        // Clear previous intents
        this.currentIntents.length = 0;

        // Check for key press
        if (this.playerNumber === 1) {
            // Lock currently held keys & look for most recently pressed movement key
            const keysHeld = [...globalThis.keysHeld];
            for (let i = keysHeld.length; i >= 0; --i) {
                switch (keysHeld[i]) {
                    case Consts.KEYS.LEFT: // Move left
                        if (keysHeld.includes( Consts.KEYS.RIGHT )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "left",
                            "endPos": this.pos.offset( -Consts.FUSEMAN_SPEED_PX_PER_SEC * dt, 0 )
                        });
                        break;
                    case Consts.KEYS.RIGHT: // Move right
                        if (keysHeld.includes( Consts.KEYS.LEFT )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "right",
                            "endPos": this.pos.offset( Consts.FUSEMAN_SPEED_PX_PER_SEC * dt, 0 )
                        });
                        break;
                    case Consts.KEYS.DOWN: // Move down
                        if (keysHeld.includes( Consts.KEYS.UP )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "down",
                            "endPos": this.pos.offset( 0, Consts.FUSEMAN_SPEED_PX_PER_SEC * dt )
                        });
                        break;
                    case Consts.KEYS.UP: // Move up
                        if (keysHeld.includes( Consts.KEYS.DOWN )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "up",
                            "endPos": this.pos.offset( 0, -Consts.FUSEMAN_SPEED_PX_PER_SEC * dt )
                        });
                        break;
                    case Consts.KEYS.PLANT: // Plant fuse
                        if (this.stats.numAvailFuses === 0) break;
                        this.currentIntents.push({ "type": "placingFuse" });
                        break;
                }
            }
        }
    }

    /**
     * Updates the Fuseman's position, including processing any key input
     */
    tick(dt: number, renderer: Renderer) {
        if (this.isDead || this.isDying) return;

        // Verify there are intents
        if (this.currentIntents.length === 0) {
            this.direction = "down";
            this.isMoving = false;
            return;
        }

        // Handle updates from current intents
        for (const intent of this.currentIntents) {
            this.isMoving = (intent.type === "movement");

            // Move from last intent
            if (intent.type === "movement") {
                // Move Fuseman
                this.direction = intent.direction!;
                this.pos.x = intent.endPos!.x;
                this.pos.y = intent.endPos!.y;
            } else {
                // Attempt to place fuse
                const x = Math.round(this.pos.x / 16);
                const y = Math.round(this.pos.y / 16);
                renderer.attemptPlaceFuse(x, y, this, this.stats.blastRadius);
            }
        }
    }

    /**
     * Increases/reduces the number of available fuses
     */
    decAvailFuses(): void { --this.stats.numAvailFuses; }
    incAvailFuses(): void { ++this.stats.numAvailFuses; }

    /**
     * Returns the current bounds based on the movement intents
     */
    getBounds(center: Point2): Point2[] {
        return [
            new Point2(center.x,      center.y),
            new Point2(center.x + 16, center.y),
            new Point2(center.x,      center.y + 16),
            new Point2(center.x + 16, center.y + 16)
        ];
    }

    /**
     * Checks for collisions between objects in O(n) time using deterministic grid lookup
     * 
     * Returns collided sprites in an array
     */
    private getCollisions(intent: ActionIntent, renderer: Renderer): Sprite[] {
        // Get references to nearby objects
        const center = new Point2(
            intent.endPos!.x + 8,
            intent.endPos!.y + 8
        );
        const nearbySprites: Sprite[] = [];

        // Determine grid coordinates
        const x = Math.floor(center.x / 16);
        const y = Math.floor(center.y / 16);

        for (let xo = x - 1; xo <= x + 1; ++xo) {
            for (let yo = y - 1; yo <= y + 1; ++yo) {
                // Skip out of bounds
                if (xo < 0 || xo >= Consts.TILES_ACROSS_EXTERIOR ||
                    yo < 0 || yo >= Consts.TILES_DOWN_EXTERIOR) {
                    continue;
                }

                // Lookup sprite
                const sprite: Sprite | null = renderer.getSpriteFromGrid( xo, yo );
                if (sprite) nearbySprites.push(sprite);
            }
        }

        // Pre-compute bounds of this object
        const bounds = this.getBounds(intent.endPos!);
        const aLeft = bounds[0].x;
        const aRight = bounds[1].x;
        const aTop = bounds[0].y;
        const aBottom = bounds[2].y;

        // Check against all nearby objects
        const collidedSprites: Sprite[] = [];
        for (const sprite of nearbySprites) {
            // Get bounds of other srpite
            const spriteBounds = sprite.getBounds();
            const bLeft = spriteBounds[0].x;
            const bRight = spriteBounds[1].x;
            const bTop = spriteBounds[0].y;
            const bBottom = spriteBounds[2].y;

            // AABB collision check
            if (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop) {
                collidedSprites.push(sprite);
            }
        }

        return collidedSprites;
    }

    /**
     * Resolves movement between colliding objects with this Fuseman, O(n) time
     */
    resolveCollisions(renderer: Renderer) {
        // Resolve for each intent
        let hasResolvedMovementIntent = false;
        for (let i = 0; i < this.currentIntents.length; ++i) {
            const intent = this.currentIntents[i];

            // Skip fuse placement intents
            if (intent.type === "placingFuse") continue;

            // Skip extra movements that predate latest valid movement (from held keys)
            if (intent.type === "movement" && hasResolvedMovementIntent) {
                this.currentIntents.splice(i, 1);
                --i;
                continue;
            }

            // Temporarily override movement intent to check individual axes
            const newEndPos = intent.endPos!.copy();

            // Test x-axis (reset y-coordinate)
            intent.endPos!.y = this.pos.y;
            let collisions = this.getCollisions(intent, renderer);

            // Flip flag until proven otherwise
            hasResolvedMovementIntent = true;

            for (const sprite of collisions) {
                if (sprite instanceof Tile) {
                    // Check if attempting to fit in a gap/round a corner
                    const tileX = Math.floor(sprite.pos.x / 16);
                    const tileY = Math.floor(sprite.pos.y / 16);
                    const gridSpaceBelow = (tileY + 1 < Consts.TILES_DOWN_EXTERIOR) ? renderer.getSpriteFromGrid(tileX, tileY + 1) : true;
                    const gridSpaceAbove = (tileY - 1 >= 0) ? renderer.getSpriteFromGrid(tileX, tileY - 1) : true;

                    // Check for gap below collided tile
                    if ( intent.endPos!.y - sprite.pos.y >= 14 && gridSpaceBelow === null ) {
                        newEndPos.y = sprite.pos.y + 16; // Fix alignment
                    } else if ( sprite.pos.y - intent.endPos!.y >= 14 && gridSpaceAbove === null ) {
                        newEndPos.y = sprite.pos.y - 16; // Fix alignment
                    } else {
                        // Correct final x-coordinate
                        newEndPos.x = sprite.pos.x + (sprite.pos.x < newEndPos.x ? 16 : -16);
                        hasResolvedMovementIntent = false;
                    }
                } else if (sprite instanceof Blast) {
                    this.startDeath();
                    return;
                }
            }

            // Test y-axis (reset x-coordinate)
            intent.endPos!.x = newEndPos.x;
            intent.endPos!.y = newEndPos.y;
            collisions = this.getCollisions(intent, renderer);

            for (const sprite of collisions) {
                if (sprite instanceof Tile) {
                    // Check if attempting to fit in a gap/round a corner
                    const tileX = Math.floor(sprite.pos.x / 16);
                    const tileY = Math.floor(sprite.pos.y / 16);
                    const gridSpaceRight = (tileX + 1 < Consts.TILES_ACROSS_EXTERIOR) ? renderer.getSpriteFromGrid(tileX + 1, tileY) : true;
                    const gridSpaceLeft = (tileX - 1 >= 0) ? renderer.getSpriteFromGrid(tileX - 1, tileY) : true;

                    // Check for gap below collided tile
                    if ( intent.endPos!.x - sprite.pos.x >= 14 && gridSpaceRight === null ) {
                        newEndPos.x = sprite.pos.x + 16; // Fix alignment
                    } else if ( sprite.pos.x - intent.endPos!.x >= 14 && gridSpaceLeft === null ) {
                        newEndPos.x = sprite.pos.x - 16; // Fix alignment
                    } else {
                        // Correct final y-coordinate
                        newEndPos.y = sprite.pos.y + (sprite.pos.y < newEndPos.y ? 16 : -16);
                        hasResolvedMovementIntent = false;
                    }
                } else if (sprite instanceof Blast) {
                    this.startDeath();
                    return;
                }
            }

            // Otherwise, didn't die so correct position
            intent.endPos!.x = Math.round(newEndPos.x);
            intent.endPos!.y = Math.round(newEndPos.y);

            // If this intent has failed due to collision, remove from intents
            if (!hasResolvedMovementIntent) {
                this.currentIntents.splice(i, 1);
                --i;
            }
        }
    }
};
