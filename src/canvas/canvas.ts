/* Base canvas class that handles common requirements like setting up the render loop and tracking mouse position */
export abstract class Canvas {
    _canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;

    width: number = 300;
    height: number = 150;

    mouseX: number = 0;
    mouseY: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
        const ctx = canvas.getContext("2d");
        if (ctx == null) {
            throw Error("Could not get 2D rendering context for canvas");
        }
        this.ctx = ctx;
    }

    /** Register event handlers and begin the draw loop for this canvas. */
    start() {
        this._registerEventHandlers();
        this._draw();
    }

    _registerEventHandlers() {
        const { _canvas } = this;

        // Track width and height of canvas
        _canvas.onresize = this._handleResize;
        this._handleResize();

        // Call setup so anything depending on width and height can be run
        this.setup();

        // Track mouse position
        _canvas.onmousemove = (e: MouseEvent) => {
            this.mouseX = e.offsetX;
            this.mouseY = e.offsetY;
            this.mouseMoved(e);
        };

        _canvas.onmousedown = (e: MouseEvent) => this.mousePressed(e);
        _canvas.onmouseup = (e: MouseEvent) => this.mouseReleased(e);
        _canvas.onwheel = (e: WheelEvent) => this.mouseWheel(e);
        _canvas.onkeydown = (e: KeyboardEvent) => this.keyPressed(e);
        _canvas.onkeyup = (e: KeyboardEvent) => this.keyUp(e);
        _canvas.ondblclick = (e: MouseEvent) => this.doubleClicked(e);
    }

    _draw() {
        this.draw();
        window.requestAnimationFrame(() => this._draw());
    }

    _handleResize() {
        const size = this._canvas.getBoundingClientRect();
        this.width = size.width;
        this.height = size.height;
        this._canvas.width = this.width;
        this._canvas.height = this.height;
    }

    abstract setup(): void;
    abstract draw(): void;
    abstract mousePressed(e: MouseEvent): void;
    abstract mouseReleased(e: MouseEvent): void;
    abstract mouseMoved(e: MouseEvent): void;
    abstract mouseWheel(e: WheelEvent): void;
    abstract keyPressed(e: KeyboardEvent): void;
    abstract keyUp(e: KeyboardEvent): void;
    abstract doubleClicked(e: MouseEvent): void;
}
