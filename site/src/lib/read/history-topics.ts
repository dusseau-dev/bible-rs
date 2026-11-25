/** History lenses shared by the study server (prompts, evidence choice) and the study panel (labels). */

/** The six lenses that steer history notes and the choice of book-context evidence. The study panel shows each `label` on history notes. */
export const HISTORY_TOPICS = [
	{
		label: 'Land & environment',
		focus: 'land, climate, water, resources, disease, and location',
		questions: 'Where could people live? What could they grow? What made travel, trade, or defense easy or difficult?',
		keywords: ['river', 'sea', 'lake', 'desert', 'wilderness', 'mountain', 'valley', 'rain', 'drought', 'famine', 'plague', 'disease', 'leprosy', 'harvest', 'region', 'border', 'climate', 'spring', 'well']
	},
	{
		label: 'Economy',
		focus: 'production, labor, trade, property, money, and taxation',
		questions: 'How did people meet their needs? Who controlled resources? Who received the surplus?',
		keywords: ['silver', 'gold', 'money', 'coin', 'denarius', 'shekel', 'tax', 'tribute', 'tithe', 'trade', 'merchant', 'market', 'wage', 'debt', 'property', 'inheritance', 'land', 'field', 'vineyard', 'flock', 'farm']
	},
	{
		label: 'Government & law',
		focus: 'governments, laws, institutions, warfare, and relations between states',
		questions: 'Who could make decisions? How were rules enforced? Why did people obey or resist?',
		keywords: ['king', 'kingdom', 'empire', 'emperor', 'governor', 'ruler', 'roman', 'rome', 'assyria', 'babylon', 'persia', 'egypt', 'herod', 'army', 'war', 'battle', 'siege', 'treaty', 'law', 'court', 'council', 'sanhedrin']
	},
	{
		label: 'Society',
		focus: 'families, classes, communities, population, and everyday life',
		questions: 'How were people organized? Who had status, rights, or opportunities? Whose work sustained society?',
		keywords: ['family', 'household', 'clan', 'tribe', 'marriage', 'widow', 'orphan', 'slave', 'servant', 'elder', 'village', 'shepherd', 'fisherman', 'peasant', 'poor', 'wealthy', 'status', 'honor', 'shame', 'meal']
	},
	{
		label: 'Religion & culture',
		focus: 'religion, values, identity, philosophy, education, and art',
		questions: 'What did people believe? What seemed legitimate, sacred, or worth fighting for?',
		keywords: ['temple', 'priest', 'sacrifice', 'worship', 'idol', 'gods', 'synagogue', 'sabbath', 'festival', 'passover', 'purity', 'clean', 'custom', 'tradition', 'pharisee', 'sadducee', 'scribe', 'greek', 'covenant']
	},
	{
		label: 'Technology',
		focus: 'tools, energy, transport, communication, and practical knowledge',
		questions: 'What could people actually do? What became cheaper, faster, or newly possible?',
		keywords: ['road', 'ship', 'boat', 'chariot', 'wall', 'gate', 'tower', 'cistern', 'aqueduct', 'tool', 'iron', 'bronze', 'plow', 'writing', 'scroll', 'letter', 'seal', 'lamp', 'oven', 'building']
	}
] as const;

/** Indexes of the history topics a text mentions, matched on whole words. */
export function historyTopicsIn(text: string): number[] {
	const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
	return HISTORY_TOPICS.flatMap((topic, index) => (topic.keywords as readonly string[]).some((word) => words.has(word)) ? [index] : []);
}

/** The label of the history topic a text mentions most, or null unless at least two of its keywords appear. */
export function historyTopicLabel(text: string): string | null {
	const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
	let best: { label: string; hits: number } | null = null;
	for (const topic of HISTORY_TOPICS) {
		const hits = (topic.keywords as readonly string[]).filter((word) => words.has(word)).length;
		if (hits >= 2 && (!best || hits > best.hits)) best = { label: topic.label, hits };
	}
	return best?.label ?? null;
}
