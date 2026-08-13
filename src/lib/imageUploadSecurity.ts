const SAFE_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type SafeImageExtension = (typeof SAFE_IMAGE_TYPES)[keyof typeof SAFE_IMAGE_TYPES];

function hasExpectedSignature(bytes: Uint8Array, type: keyof typeof SAFE_IMAGE_TYPES): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

export async function validateImageUpload(file: File, maxBytes = 5 * 1024 * 1024): Promise<SafeImageExtension> {
  if (file.size < 12 || file.size > maxBytes) throw new Error("Image must be under 5 MB");
  const type = file.type as keyof typeof SAFE_IMAGE_TYPES;
  const extension = SAFE_IMAGE_TYPES[type];
  if (!extension) throw new Error("Only JPG, PNG, and WebP images are allowed");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedSignature(bytes, type)) throw new Error("The file contents do not match its image type");
  return extension;
}
