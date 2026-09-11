import { defineCollection, z } from 'astro:content';

const services = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    shortDescription: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    category: z.enum(['cosmetic', 'preventive', 'orthodontic', 'emergency', 'pediatric', 'general']),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    icon: z.string().optional(), // SVG path or icon name
  }),
});

const team = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    role: z.string(),
    image: z.string(),
    imageAlt: z.string(),
    specialties: z.array(z.string()),
    education: z.string().optional(),
    experience: z.string().optional(),
    order: z.number().default(99),
  }),
});

const faq = defineCollection({
  type: 'content',
  schema: z.object({
    question: z.string(),
    category: z.string().default('general'),
    order: z.number().default(99),
  }),
});

export const collections = { services, team, faq };
