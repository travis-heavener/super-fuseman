/**
 * An arbitrary 2-dimensional point, represented by an x-y coordinate.
 */
export default class Point2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    /**
     * Generates a new copy of this object
     */
    copy(): Point2 {
        return new Point2(this.x, this.y);
    }

    /**
     * Returns a new Point2 with its position offset by another Point2
     */
    offset(dx: number, dy: number): Point2 {
        return new Point2(this.x + dx, this.y + dy);
    }

    /**
     * Returns true if this Point equals another
     */
    equals(p2: Point2): boolean {
        return this.x === p2.x && this.y === p2.y;
    }
};
