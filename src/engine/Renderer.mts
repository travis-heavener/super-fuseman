import Sprite from "../sprites/Sprite.mjs";
import Consts from "../tools/Consts.mjs";
import Textures from "./Textures.mjs";

/**
 * A renderer class that holds references to all sprites.
 * 
 * The draw() method is invoked by the requestAnimationFrame loop to render a frame.
 */
export default class Renderer {
    private sprites: Sprite[];

    private textures: Textures;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private constructor(textures: Textures) {
        this.sprites = [];
        this.canvas = document.getElementsByTagName("canvas")[0];
        this.ctx = this.canvas.getContext("2d") as any;

        // Update canvas sizing
        this.canvas.width = Consts.WIDTH_PX;
        this.canvas.height = Consts.HEIGHT_PX;

        // Disable image smoothing (for pixel art)
        this.ctx.imageSmoothingEnabled = false;

        // Load textures
        this.textures = textures;
    }

    static async create() {
        return new Renderer( await Textures.create() );
    }

    /**
     * Adds a new sprite
     */
    addSprite(s: Sprite) {
        this.sprites.push(s);
    }

    /**
     * Calls the draw method on each sprite
     */
    render() {
        // Draw to canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const s of this.sprites) s.draw(this.ctx, this.textures);
    }
};
