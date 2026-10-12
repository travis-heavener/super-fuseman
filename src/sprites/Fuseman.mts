import Consts from "../tools/Consts.mjs";
import Point2 from "../tools/Point2.mjs";
import Sprite from "./Sprite.mjs";
import Textures from "../engine/Textures.mjs";
import Renderer from "../engine/Renderer.mjs";
import Tile from "./Tile.mjs";
import Blast from "./Blast.mjs";
import Fuse from "./Fuse.mjs";
import Collectible, { Variant } from "./Collectible.mjs";
import NPCBrain from "../tools/NPCBrain.mjs";

/**
 * Type wrapper for movement intent, determined before collision checks and is reset each tick
 */
type ActionIntent = {
    type: "movement" | "placingFuse";
    direction?: "left" | "right" | "down" | "up";
    endPos?: Point2;
    isAdjusted?: boolean;
    collidedCollectible?: Collectible;
};

/**
 * Used for assuming directions when navigating tight corners
 */
type ForcedDirection = {
    direction: "left" | "right" | "down" | "up";
    timestamp: number;
};

/**
 * Used to handle mystery power-ups from collectibles
 */
type MysteryPowerUp = {
    timer: number;
    variant: Variant;
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

    // Timestamp of last footstep sfx
    private lastFootstepSFXTimestamp: number;

    // Used to force navigation a certain direction for a short period of time (e.g. corner navigating where multiple directions possible)
    private forcedDirection: ForcedDirection | null;

    // Stores current action intents pre-collision check per tick
    private currentIntents: ActionIntent[];

    // Fuseman's stats including blast radius, number of fuses, etc.
    private stats: FusemanStats;

    // Stores the current mystery power-ups
    private currentMysteryPowerUp: MysteryPowerUp | null;

    // Whether or not to ignore spammed fuse plant requests from keyboard
    private isIgnoringHeldFusePlants: boolean;

    // The other Fusemen currently touching this one (so power-ups only exchange on first contact)
    private touching: Set<Fuseman>;

    // Autonomous controller for non-human Fusemen
    private npcBrain: NPCBrain | null;

    // Reusable 16x32 canvas for animating temporary effects within the sprite silhouette
    private effectCanvas: HTMLCanvasElement | null;

    constructor(pos: Point2, playerNumber: number) {
        super(pos);

        // Player number, 1-5
        this.playerNumber = playerNumber;

        // Initializing to down makes the Fuseman face the player
        this.direction = "down";

        // Reset animation flags
        this.animFrameIndex = this.lastAnimationFrameTimestamp = this.lastFootstepSFXTimestamp = 0;
        this.isMoving = this.isDying = this.isDead = this.isIgnoringHeldFusePlants = false;
        this.currentIntents = [];
        this.forcedDirection = null;

        // Init Fuseman stats
        this.stats = {} as FusemanStats;
        Object.assign(this.stats, {
            "blastRadius": 2,
            "numTotalFuses": 1,
            "numAvailFuses": 1
        } as FusemanStats);
        this.currentMysteryPowerUp = null;
        this.touching = new Set();
        this.npcBrain = playerNumber === Consts.HUMAN_PLAYER_NUMBER ? null : new NPCBrain();
        this.effectCanvas = null;

        // Disable opacity
        super.disableOpaqueness();
    }

    /**
     * Initiates the demise of Fuseman
     */
    private startDeath(renderer: Renderer) {
        this.isDying = true;
        this.isMoving = false;
        this.animFrameIndex = 0;

        // Scatter each acquired permanent upgrade and any temporary effect still active
        const drops: Variant[] = [];
        for (let i = 1; i < this.stats.numTotalFuses; ++i) drops.push(Variant.EXTRA_FUSE);
        for (let i = 2; i < this.stats.blastRadius; ++i) drops.push(Variant.LARGER_BLASTS);
        if (this.currentMysteryPowerUp && this.currentMysteryPowerUp.timer > 0)
            drops.push(this.currentMysteryPowerUp.variant);
        renderer.scatterCollectibles(this.pos, drops);

        globalThis.playSound("death", 0.65);
    }

    /**
     * Ends the demise of Fuseman
     */
    private finishDeath() {
        this.isDead = true;
        this.isDying = false;
    }

    /**
     * Draws a frame with a cycling texture masked to the player's visible pixels
     */
    private drawFrame(ctx: CanvasRenderingContext2D, frame: ImageBitmap) {
        if (!this.currentMysteryPowerUp || this.isDying) {
            ctx.drawImage(frame, this.pos.x, this.pos.y - 16);
            return;
        }

        // Allocate one tiny canvas per affected Fuseman and reuse it on each frame
        if (!this.effectCanvas) {
            this.effectCanvas = document.createElement("canvas");
            this.effectCanvas.width = 16;
            this.effectCanvas.height = 32;
        }
        const effectCtx = this.effectCanvas.getContext("2d")!;
        effectCtx.clearRect(0, 0, 16, 32);
        effectCtx.drawImage(frame, 0, 0);

        // Source-atop applies the moving flecks only where the sprite has opaque pixels
        const phase = Math.floor(Date.now() / 120) % 6;
        const colors = ["#fff08a", "#8df1ff", "#ffa4e2"];
        effectCtx.globalCompositeOperation = "source-atop";
        effectCtx.globalAlpha = 0.2;
        effectCtx.fillStyle = colors[phase % colors.length];
        effectCtx.fillRect(0, 0, 16, 32);

        // Shift small highlights across the silhouette without covering the sprite art
        effectCtx.globalAlpha = 0.65;
        effectCtx.fillStyle = colors[(phase + 1) % colors.length];
        for (let y = 1; y < 32; y += 4)
            effectCtx.fillRect((phase * 3 + Math.floor(y / 4) * 3) % 16, y, 2, 2);
        effectCtx.globalCompositeOperation = "source-over";
        effectCtx.globalAlpha = 1;

        // Draw the masked frame at the same position as the unmodified sprite
        ctx.drawImage(this.effectCanvas, this.pos.x, this.pos.y - 16);
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
            this.drawFrame(ctx, textures.fusers[this.playerNumber - 1].frames[sheetFrameIndex]);

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
            this.drawFrame(ctx, textures.fusers[this.playerNumber - 1].frames[sheetFrameIndex]);

            // Cycle to next animation frame, if needed
            if (Date.now() - this.lastAnimationFrameTimestamp > Consts.ANIMATION_FRAME_INTERVAL_MS) {
                this.animFrameIndex = (this.animFrameIndex + 1) % numFrames;
                this.lastAnimationFrameTimestamp = Date.now();
            }

            // Play footstep sound, if needed
            if (Date.now() - this.lastFootstepSFXTimestamp > Consts.FOOTSTEP_SFX_INTERVAL_MS) {
                this.lastFootstepSFXTimestamp = Date.now();
                globalThis.playSound("footstep", 0.4);
            }
        } else {
            // Current frame index from the array of frames on spritesheet
            const sheetFrameIndex = textures.fusers[this.playerNumber - 1].idle;

            // Draw idle pose (shift up 16px for overdraw)
            this.drawFrame(ctx, textures.fusers[this.playerNumber - 1].frames[ sheetFrameIndex ]);
        }
    }

    /**
     * Checks for movement intent before checking collisions or moving
     */
    updateMovementIntent(dt: number, renderer: Renderer): void {
        if (this.isDead || this.isDying) return;

        // Clear previous intents
        this.currentIntents.length = 0;

        // Determine power-up modifier
        const powerupModifier = (this.currentMysteryPowerUp?.variant === Variant.SPEED_BOOST) ? 3 : 1;
        const isFlippedControls = this.currentMysteryPowerUp?.variant === Variant.FLIPPED_CONTROLS;
        const keyBinds = {
            "LEFT": !isFlippedControls ? Consts.KEYS.LEFT : Consts.KEYS.RIGHT,
            "RIGHT": !isFlippedControls ? Consts.KEYS.RIGHT : Consts.KEYS.LEFT,
            "UP": !isFlippedControls ? Consts.KEYS.UP : Consts.KEYS.DOWN,
            "DOWN": !isFlippedControls ? Consts.KEYS.DOWN : Consts.KEYS.UP
        };

        // Check for key press
        if (this.playerNumber === Consts.HUMAN_PLAYER_NUMBER) {
            // Lock currently held keys & look for most recently pressed movement key
            const keysHeld = [...globalThis.keysHeld];
            let hasAttemptedFusePlant = false;
            for (const key of keysHeld) {
                switch (key) {
                    case keyBinds.LEFT: // Move left
                        if (keysHeld.includes( keyBinds.RIGHT )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "left",
                            "endPos": this.pos.offset( powerupModifier * -Consts.FUSEMAN_SPEED_PX_PER_SEC * dt, 0 ),
                            "isAdjusted": false
                        });
                        break;
                    case keyBinds.RIGHT: // Move right
                        if (keysHeld.includes( keyBinds.LEFT )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "right",
                            "endPos": this.pos.offset( powerupModifier * Consts.FUSEMAN_SPEED_PX_PER_SEC * dt, 0 ),
                            "isAdjusted": false
                        });
                        break;
                    case keyBinds.DOWN: // Move down
                        if (keysHeld.includes( keyBinds.UP )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "down",
                            "endPos": this.pos.offset( 0, powerupModifier * Consts.FUSEMAN_SPEED_PX_PER_SEC * dt ),
                            "isAdjusted": false
                        });
                        break;
                    case keyBinds.UP: // Move up
                        if (keysHeld.includes( keyBinds.DOWN )) break;
                        this.currentIntents.push({
                            "type": "movement",
                            "direction": "up",
                            "endPos": this.pos.offset( 0, powerupModifier * -Consts.FUSEMAN_SPEED_PX_PER_SEC * dt ),
                            "isAdjusted": false
                        });
                        break;
                    case Consts.KEYS.PLANT: // Plant fuse
                        hasAttemptedFusePlant = true;
                        if (this.isIgnoringHeldFusePlants || this.stats.numAvailFuses === 0
                            || this.currentMysteryPowerUp?.variant === Variant.NO_FUSES) break;
                        this.currentIntents.push({ "type": "placingFuse", "isAdjusted": false });
                        this.isIgnoringHeldFusePlants = true;
                        break;
                }
            }

            // Stop ignoring fuse plants if key is no longer held
            if (this.isIgnoringHeldFusePlants && !hasAttemptedFusePlant) this.isIgnoringHeldFusePlants = false;
        } else if (this.npcBrain) {
            // NPC decisions use the same collision and action pipeline as player input
            const decision = this.npcBrain.decide(this, renderer, dt);
            if (decision.plant) this.currentIntents.push({ "type": "placingFuse", "isAdjusted": false });
            if (decision.direction && decision.endPos) this.currentIntents.push({
                "type": "movement", "direction": decision.direction,
                "endPos": decision.endPos, "isAdjusted": false
            });
        }
    }

    /**
     * Returns the current fuse capacity and blast reach for NPC planning
     */
    getNPCFuseStats(): { available: number, blastRadius: number } {
        return {
            "available": this.currentMysteryPowerUp?.variant === Variant.NO_FUSES ? 0 : this.stats.numAvailFuses,
            "blastRadius": this.currentMysteryPowerUp?.variant === Variant.SMALL_BLASTS ? 1 : this.stats.blastRadius
        };
    }

    /**
     * Updates the Fuseman's position, including processing any key input
     */
    tick(dt: number, renderer: Renderer) {
        if (this.isDead || this.isDying) return;

        // Update current power-up timer
        if (this.currentMysteryPowerUp) {
            if (this.currentMysteryPowerUp.timer <= 0) this.currentMysteryPowerUp = null;
            else this.currentMysteryPowerUp.timer -= dt;
        }

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

                // Check for collectible
                if (intent.collidedCollectible) {
                    const collectible = intent.collidedCollectible as Collectible;
                    if (collectible.isCollectible()) { // If not being destroyed
                        // Apply buff/power-up
                        switch (collectible.variant) {
                            case Variant.EXTRA_FUSE:
                                ++this.stats.numTotalFuses;
                                ++this.stats.numAvailFuses;
                                globalThis.playSound("collectible", 0.5);
                                break;
                            case Variant.LARGER_BLASTS:
                                ++this.stats.blastRadius;
                                globalThis.playSound("collectible", 0.5);
                                break;
                            default:
                                this.currentMysteryPowerUp = {
                                    "timer": Consts.MYSTERY_COLLECTIBLE_TIMER_SEC,
                                    "variant": collectible.variant
                                };
                                globalThis.playSound("powerup", 0.5);
                                break;
                        }

                        // Remove collectible
                        renderer.removeCollectible(collectible);
                    }
                }
            } else {
                // Attempt to place fuse
                const x = Math.round(this.pos.x / 16);
                const y = Math.round(this.pos.y / 16);
                const blastRadius = this.currentMysteryPowerUp?.variant === Variant.SMALL_BLASTS ? 1 : this.stats.blastRadius;
                renderer.attemptPlaceFuse(x, y, this, blastRadius);
            }
        }
    }

    /**
     * Returns true if this Fuseman is still in the match (neither dying nor dead)
     */
    isAlive(): boolean {
        return !this.isDying && !this.isDead;
    }

    /**
     * Returns true if this Fuseman's death animation is currently playing
     */
    isDeathAnimating(): boolean {
        return this.isDying;
    }

    /**
     * Crushes a Fuseman when a sudden-death tile lands on their position
     */
    crush(renderer: Renderer): void {
        if (this.isAlive()) this.startDeath(renderer);
    }

    /**
     * Spreads mystery power-ups between Fusemen the moment they first touch
     * 
     * Like the skull in Bomberman '93, power-ups are contagious: the carrier keeps theirs
     * while the Fuseman they touch catches it too (unless that Fuseman already has one).
     */
    resolveTouch(other: Fuseman): void {
        // Determine if these Fusemen are close enough to touch
        const isTouching = this.isAlive() && other.isAlive() &&
            Math.abs(this.pos.x - other.pos.x) < Consts.FUSEMAN_TOUCH_DISTANCE_PX &&
            Math.abs(this.pos.y - other.pos.y) < Consts.FUSEMAN_TOUCH_DISTANCE_PX;

        // Only spread on first contact (at most one side can have a power-up to spread)
        if (isTouching && !this.touching.has(other)) {
            const exchanged = this.spreadPowerUpTo(other) || other.spreadPowerUpTo(this);
            if (exchanged) globalThis.playSound("powerup", 0.35, 1.35);
        }

        // Track contact (on both sides so the pair is only checked once per tick)
        if (isTouching) {
            this.touching.add(other);
            other.touching.add(this);
        } else {
            this.touching.delete(other);
            other.touching.delete(this);
        }
    }

    /**
     * Gives another Fuseman a copy of this one's mystery power-up, with its remaining time
     * 
     * Does nothing if this Fuseman has none or the other is already affected by one.
     */
    private spreadPowerUpTo(other: Fuseman): boolean {
        if (!this.currentMysteryPowerUp || other.currentMysteryPowerUp) return false;

        other.currentMysteryPowerUp = {
            "timer": this.currentMysteryPowerUp.timer,
            "variant": this.currentMysteryPowerUp.variant
        };
        return true;
    }

    /**
     * Increases/reduces the number of available fuses
     */
    decAvailFuses(): void { --this.stats.numAvailFuses; }
    incAvailFuses(): void { ++this.stats.numAvailFuses; }

    /**
     * Returns the current bounds based on the movement intents
     */
    getBounds(pos: Point2): Point2[] {
        return [
            new Point2(pos.x,      pos.y),
            new Point2(pos.x + 16, pos.y),
            new Point2(pos.x,      pos.y + 16),
            new Point2(pos.x + 16, pos.y + 16)
        ];
    }

    /**
     * Checks for collisions between objects in O(n) time using deterministic grid lookup
     * 
     * Returns collided sprites in an array
     */
    private getCollisions(pos: Point2, renderer: Renderer): Sprite[] {
        // Get references to nearby objects
        const center = new Point2(pos.x + 8, pos.y + 8);
        const nearbySprites: Sprite[] = [];

        // Determine grid coordinates
        const x = Math.floor(center.x / 16);
        const y = Math.floor(center.y / 16);

        for (let dx = -1; dx <= 1; ++dx) {
            for (let dy = -1; dy <= 1; ++dy) {
                // Skip out of bounds
                if (x + dx < 0 || x + dx >= Consts.TILES_ACROSS_EXTERIOR ||
                    y + dy < 0 || y + dy >= Consts.TILES_DOWN_EXTERIOR) {
                    continue;
                }

                // Lookup sprite
                const sprite: Sprite | null = renderer.getSpriteFromGrid( x + dx, y + dy );
                if (sprite === null) continue;

                // If there's a Fuse on this position, ignore it
                if (dx === 0 && dy === 0 && sprite instanceof Fuse) continue;

                // Otherwise, append sprite
                nearbySprites.push(sprite);
            }
        }

        // Pre-compute bounds of this object
        const bounds = this.getBounds(pos);
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
     * Returns true if a grid space can be walked onto (empty or holding a Collectible), used for rounding corners
     */
    private isPassable(sprite: Sprite | true | null): boolean {
        return sprite === null || sprite instanceof Collectible;
    }

    /**
     * Resolves movement between colliding objects with this Fuseman, O(n) time
     */
    resolveCollisions(renderer: Renderer) {
        if (this.isDead || this.isDying) return;

        // Remove old forced directions or if the direction is no longer in the intents
        if ( this.forcedDirection &&
            (this.forcedDirection!.timestamp + 100 < Date.now() ||
            !this.currentIntents.some(i => i.type === "movement" && i.direction! !== this.forcedDirection!.direction))
        ){
            this.forcedDirection = null;
        }

        // If there are no movement intents, just check for blast collisions
        if ( !this.currentIntents.some(i => i.type === "movement") ) {
            const collisions = this.getCollisions(this.pos.copy(), renderer);
            if ( collisions.some(sprite => sprite instanceof Blast) ) {
                this.startDeath(renderer);
                return;
            }

            // Regardless, ignore checks for other intents
            return;
        }

        // Resolve for each intent
        for (let i = 0; i < this.currentIntents.length; ++i) {
            const intent = this.currentIntents[i];

            // Skip fuse placement intents
            if (intent.type === "placingFuse") continue;

            // Use forced direction, if present, discarding other directions
            if (this.forcedDirection && intent.direction !== this.forcedDirection.direction) {
                this.currentIntents.splice(i--, 1);
                continue;
            }

            // Temporarily override movement intent to check individual axes
            const newEndPos = intent.endPos!.copy();

            // Test x-axis (reset y-coordinate)
            intent.endPos!.y = this.pos.y;
            let collisions = this.getCollisions(intent.endPos!, renderer);

            // Track whether or not this intent was successful
            let hasResolvedMovementIntent = true;

            for (const sprite of collisions) {
                if (sprite instanceof Tile || sprite instanceof Fuse) {
                    // Check if attempting to fit in a gap/round a corner
                    const tileX = Math.floor(sprite.pos.x / 16);
                    const tileY = Math.floor(sprite.pos.y / 16);
                    const gridSpaceBelow = (tileY + 1 < Consts.TILES_DOWN_EXTERIOR) ? renderer.getSpriteFromGrid(tileX, tileY + 1) : true;
                    const gridSpaceAbove = (tileY - 1 >= 0) ? renderer.getSpriteFromGrid(tileX, tileY - 1) : true;

                    // Check for gap below collided tile
                    if ( intent.endPos!.y - sprite.pos.y >= 14 && this.isPassable(gridSpaceBelow) ) {
                        newEndPos.y = sprite.pos.y + 16; // Fix alignment
                        intent.isAdjusted = true;
                    } else if ( sprite.pos.y - intent.endPos!.y >= 14 && this.isPassable(gridSpaceAbove) ) {
                        newEndPos.y = sprite.pos.y - 16; // Fix alignment
                        intent.isAdjusted = true;
                    } else if ((sprite.pos.x < newEndPos.x && intent.direction === "left") ||
                        (sprite.pos.x > newEndPos.x && intent.direction === "right")
                    ) { // Correct final x-coordinate if not moving away from obstacle
                        newEndPos.x = sprite.pos.x + (sprite.pos.x < newEndPos.x ? 16 : -16);
                        hasResolvedMovementIntent = false;
                    }
                } else if (sprite instanceof Blast) {
                    this.startDeath(renderer);
                    return;
                } else if (sprite instanceof Collectible) {
                    intent.collidedCollectible = sprite;
                }
            }

            // Test y-axis (reset x-coordinate)
            intent.endPos!.x = newEndPos.x;
            intent.endPos!.y = newEndPos.y;
            collisions = this.getCollisions(intent.endPos!, renderer);

            for (const sprite of collisions) {
                if (sprite instanceof Tile || sprite instanceof Fuse) {
                    // Check if attempting to fit in a gap/round a corner
                    const tileX = Math.floor(sprite.pos.x / 16);
                    const tileY = Math.floor(sprite.pos.y / 16);
                    const gridSpaceRight = (tileX + 1 < Consts.TILES_ACROSS_EXTERIOR) ? renderer.getSpriteFromGrid(tileX + 1, tileY) : true;
                    const gridSpaceLeft = (tileX - 1 >= 0) ? renderer.getSpriteFromGrid(tileX - 1, tileY) : true;

                    // Check for gap below collided tile
                    if ( intent.endPos!.x - sprite.pos.x >= 14 && this.isPassable(gridSpaceRight) ) {
                        newEndPos.x = sprite.pos.x + 16; // Fix alignment
                        intent.isAdjusted = true;
                    } else if ( sprite.pos.x - intent.endPos!.x >= 14 && this.isPassable(gridSpaceLeft) ) {
                        newEndPos.x = sprite.pos.x - 16; // Fix alignment
                        intent.isAdjusted = true;
                    } else if ((sprite.pos.y < newEndPos.y && intent.direction === "up") ||
                        (sprite.pos.y > newEndPos.y && intent.direction === "down")
                    ) { // Correct final y-coordinate if not moving away from obstacle
                        newEndPos.y = sprite.pos.y + (sprite.pos.y < newEndPos.y ? 16 : -16);
                        hasResolvedMovementIntent = false;
                    }
                } else if (sprite instanceof Blast) {
                    this.startDeath(renderer);
                    return;
                } else if (sprite instanceof Collectible) {
                    intent.collidedCollectible = sprite;
                }
            }

            // Otherwise, didn't die so correct position
            // Preserve fractional positions for frame-rate-independent movement
            intent.endPos!.x = newEndPos.x;
            intent.endPos!.y = newEndPos.y;

            // If this intent has failed due to collision, remove from intents
            if (!hasResolvedMovementIntent) this.currentIntents.splice(i--, 1);
        }

        // Filter through any valid movement intents
        let movementIntents = this.currentIntents.filter(intent => intent.type === "movement");
        if ( movementIntents.length > 1 ) {
            // Must be between two options (due to keyboard direction lockout for opposing directions)
            const [ intentA, intentB ] = movementIntents;

            // Check for matching forced direction
            if (this.forcedDirection && this.forcedDirection.direction === intentA.direction) {
                this.currentIntents.splice( this.currentIntents.indexOf( intentB ), 1 ); // Remove B
            } else if (this.forcedDirection && this.forcedDirection.direction === intentB.direction) {
                this.currentIntents.splice( this.currentIntents.indexOf( intentA ), 1 ); // Remove A
            } else if (this.forcedDirection) {
                // No matching direction, remove all movement intents
                this.currentIntents = this.currentIntents.filter(intent => intent.type !== "movement");
            } else { // No matching forced direction
                // If both are unadjusted, choose one that doesn't match current direction
                if (!intentA.isAdjusted && !intentB.isAdjusted) {
                    if (intentA.direction === this.direction && this.isMoving) // Remove A
                        movementIntents.shift();
                    else if (intentB.direction === this.direction && this.isMoving) // Remove B
                        movementIntents.pop();
                    else // Choose first input, remove B
                        movementIntents.pop();
                } else if (intentA.isAdjusted !== intentB.isAdjusted) {
                    // One adjusted, one not, choose adjusted one
                    if (intentA.isAdjusted) // Remove B
                        movementIntents.pop();
                    else if (intentB.isAdjusted) // Remove A
                        movementIntents.shift();
                    else // Choose first input, remove B
                        movementIntents.pop();
                } else {
                    // Both adjusted, choose first input
                    movementIntents.pop(); // Remove B
                }

                // Force a new direction
                this.forcedDirection = { "direction": movementIntents[0].direction!, "timestamp": Date.now() };

                // Remove old movement intents
                this.currentIntents = this.currentIntents.filter((intent) => {
                    return intent.type !== "movement" || (intent.type === "movement" && intent === movementIntents[0])
                });
            }
        }
    }
};
