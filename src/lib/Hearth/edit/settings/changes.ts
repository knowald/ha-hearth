/** How many of `keys` hold a different value in `after` than in `before`. */
export function countChanged<T extends object>(
	keys: readonly (keyof T)[],
	before: T,
	after: T
): number {
	return keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).length;
}
