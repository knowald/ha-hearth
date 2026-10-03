/**
 * The scale settings rely on standardized CSS zoom (Chromium 128, Firefox
 * 126), which also scales viewport units and reports rects in screen pixels.
 * Older engines apply zoom without those rules, so the scale stays at 100%
 * there. Server rendering assumes support so supported browsers do not flash.
 */
export const zoomSupported =
	typeof Element === 'undefined' || 'currentCSSZoom' in Element.prototype;
