"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/language-provider";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUploader({
  value,
  fallback,
  onChange,
}: {
  value: string | null;
  fallback: string;
  onChange: (url: string | null) => void;
}) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t("profile.photoType"));
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(t("profile.photoTooBig"));
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `avatars/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(`No se pudo subir: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-brand/10 flex items-center justify-center active:opacity-80"
      >
        {value ? (
          <Image src={value} alt="" fill className="object-cover" />
        ) : (
          <span className="text-2xl font-bold text-brand">{fallback}</span>
        )}
        <span className="absolute bottom-0 inset-x-0 h-7 bg-black/60 flex items-center justify-center">
          {uploading ? (
            <Loader2 size={13} className="animate-spin text-white" />
          ) : (
            <Camera size={13} className="text-white" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {error && <p className="text-xs text-danger text-center">{error}</p>}
    </div>
  );
}
