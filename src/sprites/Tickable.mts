import Renderer from "../engine/Renderer.mjs";

/**
 * An interface for Sprites that are updated each game tick
 */
export default interface Tickable {
    /**
     * Updates the sprite for a game tick
     */
    tick(dt: number, renderer: Renderer): any;
};
