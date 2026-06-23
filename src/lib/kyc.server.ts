import { supabaseAdmin } from "@/integrations/supabase/client.server";

type KycFileDescriptor = {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileBase64: string;
};

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function extensionFor(file: KycFileDescriptor) {
  const fromName = file.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return extensionByMime[file.fileType] ?? "jpg";
}

export async function uploadKycFile(userId: string, kind: "doc" | "selfie", file: KycFileDescriptor) {
  const path = `${userId}/kyc-${kind}-${Date.now()}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const base64 = file.fileBase64.includes(",") ? file.fileBase64.split(",").pop()! : file.fileBase64;
  const body = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const { error } = await supabaseAdmin.storage.from("kyc-docs").upload(path, body, {
    contentType: file.fileType || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return { path };
}