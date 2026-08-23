import { z } from 'zod';
export const schemas = {
  pages: {
    ai_tutor: z.object({
      "suggestedQuestions": z.array(z.string())
    }),
    admin: z.object({
      "tabs": z.array(z.object({
        "id": z.string(),
        "label": z.string(),
        "path": z.string()
      }))
    })
  }
};
export type Schemas = typeof schemas;