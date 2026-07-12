/** Stable hue (0-359) derived from a member name, for avatar chips. */
export function memberHue(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % 360;
}

export function memberInitial(name: string): string {
	return [...name.trim()][0]?.toUpperCase() ?? '?';
}
