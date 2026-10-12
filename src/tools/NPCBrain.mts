import Consts from "./Consts.mjs";
import Point2 from "./Point2.mjs";
import type Renderer from "../engine/Renderer.mjs";
import type Fuseman from "../sprites/Fuseman.mjs";
import Fuse from "../sprites/Fuse.mjs";
import Collectible from "../sprites/Collectible.mjs";
import MutableTile from "../sprites/MutableTile.mjs";

/**
 * A tile in a route through the arena
 */
type RouteTile = { x: number, y: number };

/**
 * A predicted fuse explosion and the tiles it will cover
 */
type Threat = { timer: number, tiles: Set<string> };

/**
 * Controls a non-human Fuseman using the same movement intents as the player
 */
export default class NPCBrain {
    // The next tile to walk to, retained between animation frames
    private nextTile: RouteTile | null = null;

    // The exploration destination, retained until reached or blocked
    private destination: RouteTile | null = null;

    // Time since the last fuse plant and visits to each tile
    private plantCooldown = 0;
    private visits = new Map<string, number>();

    /**
     * Returns a stable key for grid coordinates
     */
    private key(tile: RouteTile): string {
        return `${tile.x},${tile.y}`;
    }

    /**
     * Returns the four neighboring tiles in a shuffled order to vary NPC routes
     */
    private neighbors(tile: RouteTile): RouteTile[] {
        const neighbors = [
            { "x": tile.x + 1, "y": tile.y }, { "x": tile.x - 1, "y": tile.y },
            { "x": tile.x, "y": tile.y + 1 }, { "x": tile.x, "y": tile.y - 1 }
        ];
        return neighbors.sort(() => Math.random() - 0.5);
    }

    /**
     * Checks whether a tile is clear for walking, including the arena boundary
     */
    private isWalkable(tile: RouteTile, renderer: Renderer): boolean {
        if (tile.x <= 0 || tile.y <= 0 || tile.x >= Consts.TILES_ACROSS_EXTERIOR - 1 ||
            tile.y >= Consts.TILES_DOWN_EXTERIOR - 1) return false;

        const sprite = renderer.getSpriteFromGrid(tile.x, tile.y);
        return sprite === null || sprite instanceof Collectible;
    }

    /**
     * Predicts blast coverage using the same wall and collectible stops as the renderer
     */
    private blastTiles(tile: RouteTile, radius: number, renderer: Renderer): Set<string> {
        const tiles = new Set<string>([this.key(tile)]);
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (const [dx, dy] of directions) {
            for (let distance = 1; distance <= radius; ++distance) {
                const next = { "x": tile.x + dx * distance, "y": tile.y + dy * distance };
                if (next.x <= 0 || next.y <= 0 || next.x >= Consts.TILES_ACROSS_EXTERIOR - 1 ||
                    next.y >= Consts.TILES_DOWN_EXTERIOR - 1) break;

                const sprite = renderer.getSpriteFromGrid(next.x, next.y);
                if (sprite instanceof MutableTile || sprite instanceof Collectible ||
                    (sprite !== null && !(sprite instanceof Fuse))) break;

                tiles.add(this.key(next));
                if (sprite instanceof Fuse) break;
            }
        }

        return tiles;
    }

    /**
     * Builds fuse threats and accounts for early detonation when blasts chain into another fuse
     */
    private getThreats(renderer: Renderer, extra?: { tile: RouteTile, radius: number }): Threat[] {
        const fuses = renderer.getFuses();
        const threats = fuses.map(fuse => ({
            "timer": fuse.getThreat().timer,
            "tiles": this.blastTiles({ "x": fuse.pos.x / 16, "y": fuse.pos.y / 16 },
                fuse.getThreat().blastRadius, renderer)
        }));

        // A planted fuse is still passable for its owner, but blocks blast propagation
        if (extra) threats.push({ "timer": Consts.FUSE_TIMER_SEC, "tiles": this.blastTiles(extra.tile, extra.radius, renderer) });

        // Propagate chain reactions until no earlier detonation can be found
        for (let pass = 0; pass < threats.length; ++pass) {
            let changed = false;
            for (let i = 0; i < threats.length; ++i) {
                for (let j = 0; j < fuses.length; ++j) {
                    if (i === j || !threats[i].tiles.has(this.key({ "x": fuses[j].pos.x / 16,
                        "y": fuses[j].pos.y / 16 }))) continue;
                    const timer = threats[i].timer + Consts.FUSE_CHAIN_DELAY_SEC;
                    if (timer < threats[j].timer) {
                        threats[j].timer = timer;
                        changed = true;
                    }
                }
            }
            if (!changed) break;
        }

        return threats;
    }

    /**
     * Finds reachable tiles without routing into a fuse, wall, or predicted blast
     */
    private findRoutes(start: RouteTile, renderer: Renderer, threats: Threat[],
        allowCrossingThreat: boolean = false): Map<string, RouteTile[]> {
        const routes = new Map<string, RouteTile[]>([[this.key(start), []]]);
        const queue = [start];

        for (let index = 0; index < queue.length; ++index) {
            const tile = queue[index];
            const route = routes.get(this.key(tile))!;

            for (const next of this.neighbors(tile)) {
                const key = this.key(next);
                // A blast lane can be crossed if there is time to leave it before detonation
                const timeToLeave = (route.length + 1) * 16 / Consts.FUSEMAN_SPEED_PX_PER_SEC + 0.2;
                if (routes.has(key) || !this.isWalkable(next, renderer) ||
                    threats.some(threat => threat.tiles.has(key) &&
                        (!allowCrossingThreat || timeToLeave >= threat.timer))) continue;

                routes.set(key, [...route, next]);
                queue.push(next);
            }
        }

        return routes;
    }

    /**
     * Chooses a reachable refuge with enough travel time before any fuse detonates
     */
    private findRefuge(start: RouteTile, renderer: Renderer, threats: Threat[]): RouteTile[] | null {
        const routes = this.findRoutes(start, renderer, threats, true);
        const tileTime = 16 / Consts.FUSEMAN_SPEED_PX_PER_SEC;

        for (const route of routes.values()) {
            if (route.length === 0) continue;
            const end = route[route.length - 1];
            if (threats.some(threat => threat.tiles.has(this.key(end)))) continue;
            if (threats.every(threat => route.length * tileTime + 0.2 < threat.timer ||
                !threat.tiles.has(this.key(start)))) return route;
        }

        return null;
    }

    /**
     * Chooses a useful reachable tile while penalizing repeatedly visited corridors
     */
    private chooseDestination(start: RouteTile, fuseman: Fuseman, renderer: Renderer,
        routes: Map<string, RouteTile[]>, threats: Threat[]): RouteTile | null {
        let best: RouteTile | null = null;
        let bestScore = -Infinity;

        for (const [key, route] of routes) {
            if (route.length === 0) continue;
            const tile = route[route.length - 1];
            if (threats.some(threat => threat.tiles.has(key))) continue;
            const sprite = renderer.getSpriteFromGrid(tile.x, tile.y);
            const nearbyWall = this.neighbors(tile).some(next => next.x > 0 && next.y > 0 &&
                next.x < Consts.TILES_ACROSS_EXTERIOR - 1 && next.y < Consts.TILES_DOWN_EXTERIOR - 1 &&
                renderer.getSpriteFromGrid(next.x, next.y) instanceof MutableTile);
            const opponents = renderer.getFusers().filter(other => other !== fuseman && other.isAlive());
            const opponentDistance = opponents.length ? Math.min(...opponents.map(other =>
                Math.abs(tile.x - Math.round(other.pos.x / 16)) +
                Math.abs(tile.y - Math.round(other.pos.y / 16)))) : 0;
            const score = (sprite instanceof Collectible ? 16 : 0) + (nearbyWall ? 5 : 0) -
                route.length * 0.7 - (this.visits.get(key) || 0) * 3 -
                opponentDistance * 1.2 + Math.random() * 2;

            if (score > bestScore) {
                bestScore = score;
                best = tile;
            }
        }

        return best;
    }

    /**
     * Produces a movement or fuse placement decision for the current frame
     */
    decide(fuseman: Fuseman, renderer: Renderer, dt: number): {
        direction?: "left" | "right" | "up" | "down", endPos?: Point2, plant?: boolean
    } {
        this.plantCooldown = Math.max(0, this.plantCooldown - dt);
        const start = { "x": Math.round(fuseman.pos.x / 16), "y": Math.round(fuseman.pos.y / 16) };
        const aligned = Math.abs(fuseman.pos.x - start.x * 16) < 0.001 &&
            Math.abs(fuseman.pos.y - start.y * 16) < 0.001;
        const threats = this.getThreats(renderer);

        // Finish a tile crossing before choosing a new route
        if (this.nextTile && aligned && this.key(this.nextTile) === this.key(start)) {
            this.nextTile = null;
            const key = this.key(start);
            this.visits.set(key, (this.visits.get(key) || 0) + 1);
        }

        if (aligned) {
            const threatened = threats.some(threat => threat.tiles.has(this.key(start)));
            if (threatened) {
                // Escape first, including from our own newly planted fuse
                const escape = this.findRefuge(start, renderer, threats);
                this.nextTile = escape?.[0] || null;
                this.destination = null;
            } else {
                const routes = this.findRoutes(start, renderer, threats);
                const stats = fuseman.getNPCFuseStats();
                const nearbyWall = this.neighbors(start).some(tile => tile.x > 0 && tile.y > 0 &&
                    tile.x < Consts.TILES_ACROSS_EXTERIOR - 1 && tile.y < Consts.TILES_DOWN_EXTERIOR - 1 &&
                    renderer.getSpriteFromGrid(tile.x, tile.y) instanceof MutableTile);

                // Bomb a breakable wall or an opponent in range only if escape is possible
                const blast = this.blastTiles(start, stats.blastRadius, renderer);
                const opponentInRange = renderer.getFusers().some(other => other !== fuseman && other.isAlive() &&
                    blast.has(this.key({ "x": Math.round(other.pos.x / 16), "y": Math.round(other.pos.y / 16) })));
                if ((nearbyWall || opponentInRange) && stats.available > 0 && this.plantCooldown === 0 &&
                    renderer.getSpriteFromGrid(start.x, start.y) === null) {
                    const plantedThreats = this.getThreats(renderer, { "tile": start, "radius": stats.blastRadius });
                    if (this.findRefuge(start, renderer, plantedThreats)) {
                        this.plantCooldown = Consts.FUSE_TIMER_SEC + Consts.BLAST_TIMER_SEC;
                        this.nextTile = null;
                        this.destination = null;
                        return { "plant": true };
                    }
                }

                // Keep a destination until it is reached or another fuse blocks the route
                if (!this.destination || this.key(this.destination) === this.key(start) ||
                    !routes.has(this.key(this.destination)) ||
                    threats.some(threat => threat.tiles.has(this.key(this.destination!)))) {
                    this.destination = this.chooseDestination(start, fuseman, renderer, routes, threats);
                }
                this.nextTile = this.destination ? routes.get(this.key(this.destination))?.[0] || null : null;
            }
        }

        if (!this.nextTile) return {};

        // Clamp the step to the next tile center to avoid drifting past intersections
        const targetX = this.nextTile.x * 16;
        const targetY = this.nextTile.y * 16;
        const step = Math.min(Consts.FUSEMAN_SPEED_PX_PER_SEC * dt, 16);
        if (Math.abs(targetX - fuseman.pos.x) > 0.001) {
            const delta = Math.max(-step, Math.min(step, targetX - fuseman.pos.x));
            return { "direction": delta < 0 ? "left" : "right", "endPos": fuseman.pos.offset(delta, 0) };
        }
        const delta = Math.max(-step, Math.min(step, targetY - fuseman.pos.y));
        return { "direction": delta < 0 ? "up" : "down", "endPos": new Point2(targetX, fuseman.pos.y + delta) };
    }
};
