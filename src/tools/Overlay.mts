/**
 * An HTML overlay for pause & match end text
 * 
 * This is DOM text rather than canvas text so it stays crisp when the (low resolution) canvas is scaled up.
 */
export default class Overlay {
    private container: HTMLElement;
    private title: HTMLElement;
    private subtitle: HTMLElement;

    constructor() {
        this.container = document.getElementById("overlay") as HTMLElement;
        this.title = document.getElementById("overlay-title") as HTMLElement;
        this.subtitle = document.getElementById("overlay-subtitle") as HTMLElement;
    }

    /**
     * Displays the overlay with a title and optional subtitle
     */
    show(title: string, subtitle: string = "") {
        this.title.textContent = title;
        this.subtitle.textContent = subtitle;
        this.container.classList.add("visible");
    }

    /**
     * Updates the subtitle without changing the title
     */
    setSubtitle(subtitle: string) {
        this.subtitle.textContent = subtitle;
    }

    /**
     * Hides the overlay
     */
    hide() {
        this.container.classList.remove("visible");
    }
};
