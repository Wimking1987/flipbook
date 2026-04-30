declare module "page-flip/dist/js/page-flip.browser.js" {
  export type PageBoundsRect = {
    left: number;
    top: number;
    width: number;
    height: number;
    pageWidth: number;
  };

  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromImages(images: string[]): void;
    loadFromHTML(pages: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getBoundsRect(): PageBoundsRect;
    on(event: string, callback: (e: unknown) => void): PageFlip;
    off(event: string): void;
    update(): void;
  }
}
