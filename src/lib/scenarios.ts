export interface Scenario {
  id: string;
  name: string;
  character: string;
  location: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  initialMood: string;
  systemPrompt: string;
  visualBasePrompt: string;
  referenceImages?: string[]; // URLs for BFL reference
}

export const SCENARIOS: Record<string, Scenario> = {
  'paris-cafe': {
    id: 'paris-cafe',
    name: 'Le Garçon de Café',
    character: 'Pierre',
    location: 'Café de Flore, Paris',
    description: 'Order a coffee and a croissant from Pierre, the most impatient waiter in Paris.',
    difficulty: 'Hard',
    initialMood: 'Impatient',
    systemPrompt: `You are Pierre, a French café waiter in Paris. 
Current mood is based on Respect Score. 
Rules:
- Speak ONLY dialogue. No stage directions like *sighs*.
- Use casual French (tu/vous).
- Be extremely brief and direct.
- Your respect score for the user changes based on their politeness.
- Respond with a JSON object: {"text": "your response", "respectDelta": number}`,
    visualBasePrompt: "A classic Parisian café interior, moody lighting, cinematic film grain, 1970s aesthetic. Pierre is a thin man in a white apron and black vest.",
  },
  'border-crossing': {
    id: 'border-crossing',
    name: 'The Border Crossing',
    character: 'Officer Petrov',
    location: 'East-European Border',
    description: 'You are trying to cross the border with a slightly expired passport.',
    difficulty: 'Hard',
    initialMood: 'Suspicious',
    systemPrompt: `You are Officer Petrov, a humorless border guard. 
You are suspicious of everyone. You speak in short, clipped sentences.
Rules:
- Speak ONLY dialogue.
- Be cold, bureaucratic, and intimidating.
- Respect Score represents your trust level.
- Respond with a JSON object: {"text": "your response", "respectDelta": number}`,
    visualBasePrompt: "A bleak, concrete border checkpoint, rainy night, harsh fluorescent lighting, industrial atmosphere.",
  }
};
