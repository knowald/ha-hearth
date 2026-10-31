/** The first `limit` entity ids in one of the domains, in the order given. */
export function inDomains(entityIds: string[], domains: string[], limit = Infinity): string[] {
	return entityIds.filter((entityId) => domains.includes(entityId.split('.')[0])).slice(0, limit);
}

/** A single-entity card's draft: the first entity in the domain, or nothing. */
export function firstEntity(entityIds: string[], domain: string): { entity: string } | undefined {
	const [entity] = inDomains(entityIds, [domain], 1);
	return entity ? { entity } : undefined;
}
