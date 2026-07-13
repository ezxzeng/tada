/** Long-press-then-drag reordering for a vertical list of rows. */

const LONG_PRESS_MS = 320;
/** Moving further than this before the long press fires means "scroll", not "drag". */
const SLOP_PX = 8;
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

	#commit: (ids: string[]) => void;
	#rows: Row[] = [];
	#gap = 0;
	#from = 0;
	#to = 0;
	#startY = 0;
	#pointerY = 0;
	#pressTimer: ReturnType<typeof setTimeout> | null = null;
	#scrollFrame: number | null = null;
	#pending: { el: HTMLElement; id: string; x: number; y: number } | null = null;
	#cleanup: (() => void) | null = null;

	/** `commit` receives every row id in its new order. */
	constructor(commit: (ids: string[]) => void) {
		this.#commit = commit;
	}

	offsetOf(id: string): number {
		return this.offsets[id] ?? 0;
	}

	/** Attach to a row's onpointerdown. The row element needs `data-item-id`. */
	press(event: PointerEvent, id: string): void {
		if (event.button !== 0 && event.pointerType === 'mouse') return;
		// Let the checkbox, the delete button and the edit inputs work normally.
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, .icon')) return;

		const el = event.currentTarget as HTMLElement;
		this.#pending = { el, id, x: event.clientX, y: event.clientY };
		this.#pressTimer = setTimeout(() => this.#begin(), LONG_PRESS_MS);
		this.#listen();
	}

	#listen(): void {
		const onTouchMove = (e: TouchEvent) => {
			const touch = e.touches[0];
			if (!touch) return;
			if (this.activeId) {
				// Only this drag may scroll the page — needs a non-passive listener.
				e.preventDefault();
				this.#track(touch.clientY);
			} else {
				this.#maybeCancel(touch.clientX, touch.clientY);
			}
		};
		const onPointerMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch') return; // handled by the touch listener
			if (this.activeId) this.#track(e.clientY);
			else this.#maybeCancel(e.clientX, e.clientY);
		};
		const onUp = () => this.#end(true);
		const onCancel = () => this.#end(false);
		// A page scroll before the long press fires means the user is scrolling, not
		// dragging. Once dragging, the only scrolling is our own auto-scroll.
		const onScroll = () => {
			if (!this.activeId) this.#end(false);
		};

		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
		window.addEventListener('contextmenu', onCancel);
		window.addEventListener('scroll', onScroll);

		this.#cleanup = () => {
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			window.removeEventListener('contextmenu', onCancel);
			window.removeEventListener('scroll', onScroll);
			this.#cleanup = null;
		};
	}

	/** Before the long press fires, any real movement means the user is scrolling. */
	#maybeCancel(x: number, y: number): void {
		const start = this.#pending;
		if (!start) return;
		if (Math.abs(x - start.x) > SLOP_PX || Math.abs(y - start.y) > SLOP_PX) this.#end(false);
	}

	#begin(): void {
		const start = this.#pending;
		if (!start) return;
		const siblings = [...(start.el.parentElement?.children ?? [])] as HTMLElement[];
		const rows: Row[] = [];
		for (const el of siblings) {
			const id = el.dataset.itemId;
			if (!id) continue;
			const rect = el.getBoundingClientRect();
			rows.push({ id, top: rect.top + window.scrollY, height: rect.height });
		}
		const from = rows.findIndex((r) => r.id === start.id);
		if (from === -1 || rows.length < 2) return this.#end(false);

		this.#rows = rows;
		this.#gap = rows[1].top - (rows[0].top + rows[0].height);
		this.#from = from;
		this.#to = from;
		this.#pointerY = start.y;
		this.#startY = start.y + window.scrollY;
		this.activeId = start.id;
		this.offsets = { [start.id]: 0 };
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
		if (this.#pressTimer) clearTimeout(this.#pressTimer);
		if (this.#scrollFrame !== null) cancelAnimationFrame(this.#scrollFrame);
		this.#pressTimer = null;
		this.#scrollFrame = null;
		this.#pending = null;
		this.#cleanup?.();

		const dragging = this.activeId !== null;
		if (dragging && commit && this.#to !== this.#from) {
			const ids = this.#rows.map((r) => r.id);
			const [moved] = ids.splice(this.#from, 1);
			ids.splice(this.#to, 0, moved);
			this.#commit(ids);
		}
		if (dragging) this.#suppressNextClick();

		this.activeId = null;
		this.offsets = {};
		this.#rows = [];
	}

	/** A drag that ends over the row's text must not open the editor. */
	#suppressNextClick(): void {
		const swallow = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
		};
		window.addEventListener('click', swallow, { capture: true, once: true });
		setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 300);
	}
}
