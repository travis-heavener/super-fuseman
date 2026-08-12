export {};

declare global {
    // Returns true if a key is pressed, by event.code
    var keysHeld: string[];

    // Plays a sound effect by name
    var playSound: Function;
}
