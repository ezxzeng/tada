/** Drag-handle reordering for a vertical list of rows. */

/** Dragging within this distance of the top/bottom of the viewport scrolls the page. */
const EDGE_PX = 72;
/** Auto-scroll speed at the very edge of the viewport, in px per frame. */
const MAX_SCROLL_STEP = 14;

/** Row geometry, in document coordinates so it survives scrolling mid-drag. */
type Row = { id: string; top: number; height: number };

export class DragSort {
	/** The row currently being dragged, if any. */
	activeId = $state<string | null>(null);
	/** translateY, in px, for each row while a drag is in progress. */
	offsets = $state<Record<string, number>>({});
	/**
	 * True for the frame the reordered list lands in. Committing moves the rows to their
	 * new slots and drops their offsets at once, which is a no-op on screen — but only if
	 * rows don't animate it, since they would animate the dropped offset against the slot
	 * they just moved into and travel a whole row to get back.
	 */
	settling = $state(false);

	#commit: (ids: string[]) => void;
	#rows: Row[] = [];
	#gap = 0;
	#from = 0;
	#to = 0;
	#startY = 0;
	#pointerY = 0;
	#scrollFrame: number | null = null;
	#cleanup: (() => void) | null = null;

	/** `commit` receives every row id in its new order. */
	constructor(commit: (ids: string[]) => void) {
		this.#commit = commit;
	}

	offsetOf(id: string): number {
		return this.offsets[id] ?? 0;
	}

	/**
	 * Attach to the drag handle's onpointerdown. The handle must sit inside an element
	 * carrying `data-item-id`, and needs `touch-action: none` in CSS so the browser
	 * never claims the gesture as a page scroll.
	 */
	press(event: PointerEvent, id: string): void {
		if (event.button !== 0 && event.pointerType === 'mouse') return;
		const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-item-id]');
		if (!el) return;

		// The handle exists only to drag, so the drag starts on contact — no long press
		// to wait out, and no text selection on the way.
		event.preventDefault();
		this.#begin(el, id, event.clientY);
		if (this.activeId) this.#listen();
	}

	#listen(): void {
		const onTouchMove = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (!touch) return;
			// Only this drag may scroll the page — needs a non-passive listener.
			if (e.cancelable) e.preventDefault();
			this.#track(touch.clientY);
		};
		const onTouchEnd = () => this.#end(true);
		const onTouchCancel = () => this.#end(false);
		// Touch is driven by the listeners above. The browser also fires pointercancel
		// the moment it claims the gesture for its own long-press (selection, callout),
		// which would otherwise tear down a drag that is running perfectly well.
		const isTouch = (e: PointerEvent) => e.pointerType === 'touch';
		const onPointerMove = (e: PointerEvent) => {
			if (!isTouch(e)) this.#track(e.clientY);
		};
		const onUp = (e: PointerEvent) => {
			if (!isTouch(e)) this.#end(true);
		};
		const onCancel = (e: PointerEvent) => {
			if (!isTouch(e)) this.#end(false);
		};
		// The OS long-press menu lands in the middle of the drag. Swallow it.
		const onContextMenu = (e: Event) => e.preventDefault();

		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('touchend', onTouchEnd);
		window.addEventListener('touchcancel', onTouchCancel);
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
		window.addEventListener('contextmenu', onContextMenu);

		this.#cleanup = () => {
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onTouchEnd);
			window.removeEventListener('touchcancel', onTouchCancel);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			window.removeEventListener('contextmenu', onContextMenu);
			this.#cleanup = null;
		};
	}

	#begin(el: HTMLElement, id: string, clientY: number): void {
		const siblings = [...(el.parentElement?.children ?? [])] as HTMLElement[];
		const rows: Row[] = [];
		for (const sibling of siblings) {
			const rowId = sibling.dataset.itemId;
			if (!rowId) continue;
			const rect = sibling.getBoundingClientRect();
			rows.push({ id: rowId, top: rect.top + window.scrollY, height: rect.height });
		}
		const from = rows.findIndex((r) => r.id === id);
		if (from === -1 || rows.length < 2) return;

		this.#rows = rows;
		this.#gap = rows[1].top - (rows[0].top + rows[0].height);
		this.#from = from;
		this.#to = from;
		this.#pointerY = clientY;
		this.#startY = clientY + window.scrollY;
		this.activeId = id;
		this.offsets = { [id]: 0 };
		navigator.vibrate?.(12);
		this.#scrollFrame = requestAnimationFrame(() => this.#autoScroll());
	}

	/** Record where the pointer is (viewport coords) and re-place the dragged row. */
	#track(clientY: number): void {
		this.#pointerY = clientY;
		this.#move();
	}

	/**
	 * While the pointer sits near the top or bottom edge, scroll the page — the
	 * dragged row keeps following the pointer as fresh rows come into view.
	 */
	#autoScroll(): void {
		if (!this.activeId) return;
		const y = this.#pointerY;
		const height = window.innerHeight;

		let step = 0;
		if (y < EDGE_PX) step = -MAX_SCROLL_STEP * ((EDGE_PX - y) / EDGE_PX);
		else if (y > height - EDGE_PX) step = MAX_SCROLL_STEP * ((y - (height - EDGE_PX)) / EDGE_PX);

		if (step !== 0) {
			const before = window.scrollY;
			window.scrollBy(0, step);
			if (window.scrollY !== before) this.#move();
		}
		this.#scrollFrame = requestAnimationFrame(() => this.#autoScroll());
	}

	#move(): void {
		const rows = this.#rows;
		const from = this.#from;
		const dragged = rows[from];
		const first = rows[0];
		const last = rows[rows.length - 1];

		// Keep the dragged row inside the list's bounds.
		const pointerY = this.#pointerY + window.scrollY;
		const min = first.top - dragged.top;
		const max = last.top + last.height - dragged.height - dragged.top;
		const delta = Math.min(Math.max(pointerY - this.#startY, min), max);
		const draggedTop = dragged.top + delta;

		// The slot whose resting position is closest to where the row now sits.
		let to = from;
		let best = Infinity;
		rows.forEach((row, j) => {
			const top = j > from ? row.top + row.height - dragged.height : row.top;
			const distance = Math.abs(top - draggedTop);
			if (distance < best) {
				best = distance;
				to = j;
			}
		});
		this.#to = to;

		const shift = dragged.height + this.#gap;
		const offsets: Record<string, number> = { [dragged.id]: delta };
		rows.forEach((row, k) => {
			if (k === from) return;
			if (to > from && k > from && k <= to) offsets[row.id] = -shift;
			else if (to < from && k >= to && k < from) offsets[row.id] = shift;
			else offsets[row.id] = 0;
		});
		this.offsets = offsets;
	}

	#end(commit: boolean): void {
		if (this.#scrollFrame !== null) cancelAnimationFrame(this.#scrollFrame);
		this.#scrollFrame = null;
		this.#cleanup?.();

		if (this.activeId !== null && commit && this.#to !== this.#from) {
			const ids = this.#rows.map((r) => r.id);
			const [moved] = ids.splice(this.#from, 1);
			ids.splice(this.#to, 0, moved);
			this.#commit(ids);
			this.settling = true;
			// Two frames: the first paints the new order untransitioned, the second re-arms
			// the transition for the next drag.
			requestAnimationFrame(() => requestAnimationFrame(() => (this.settling = false)));
		}

		this.activeId = null;
		this.offsets = {};
		this.#rows = [];
	}
}
