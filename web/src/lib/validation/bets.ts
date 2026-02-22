import { z } from "zod";

export const placeBetsSchema = z.object({
  bets: z
    .array(
      z.object({
        market_id: z.string().uuid(),
        selection_key: z.string().min(1),
        stake: z.number().positive().max(100),
      }),
    )
    .min(1),
});

export type PlaceBetsInput = z.infer<typeof placeBetsSchema>;
