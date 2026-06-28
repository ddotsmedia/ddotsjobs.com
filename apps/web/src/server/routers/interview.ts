import { z } from 'zod';
import { callAI } from '@ddotsjobs/ai';
import { interviewGenerateQuestionsPrompt } from '@ddotsjobs/ai/prompts';
import { protectedProcedure, router } from '../trpc.js';

export const interviewRouter = router({
  generateQuestions: protectedProcedure
    .input(
      z.object({
        jobTitle: z.string().min(2).max(120),
        category: z.string().max(60).default(''),
        employerType: z.string().max(60).default(''),
        language: z.enum(['ml', 'en']).default('ml'),
      }),
    )
    .mutation(async ({ input }) => {
      const spec = interviewGenerateQuestionsPrompt(input);
      const { data } = await callAI({ task: spec.task, prompt: spec.prompt, system: spec.system, schema: spec.schema });
      return data;
    }),
});
