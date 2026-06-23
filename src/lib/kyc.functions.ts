import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uploadKycFile } from "./kyc.server";

const fileSchema = z.object({
  fileName: z.string().min(1).max(180),
  fileType: z.string().min(1).max(80),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  fileBase64: z.string().min(1).max(28 * 1024 * 1024),
});

export const uploadKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      kind: z.enum(["doc", "selfie"]),
      file: fileSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return uploadKycFile(context.userId, data.kind, data.file);
  });