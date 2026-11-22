import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	CHEAPERINFERENCE_API_KEY: {
		schema: (value: string | undefined) => value,
		description: 'Optional server-side CheaperInference key for passage study'
	},
	OPENAI_API_KEY: {
		schema: (value: string | undefined) => value,
		description: 'Optional server-side OpenAI key for passage study'
	}
});
