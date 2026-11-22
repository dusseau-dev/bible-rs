import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	CHEAPERINFERENCE_API_KEY: {
		schema: (value: string | undefined) => value,
		description: 'Optional CheaperInference key for local passage study development'
	},
	OPENAI_API_KEY: {
		schema: (value: string | undefined) => value,
		description: 'Optional server-side key for local passage study development'
	}
});
