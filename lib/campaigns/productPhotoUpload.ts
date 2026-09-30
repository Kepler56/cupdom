import { createClient } from '@/lib/supabase/client';
import { setProductImageUrl } from '@/lib/campaigns/campaigns';
import { productPhotoPath, validateProductPhoto } from '@/lib/campaigns/productPhoto';

export const PRODUCT_PHOTO_UPLOAD_ERROR = "Envoi de la photo impossible. Réessayez.";

/**
 * Upload a product photo to `sponsor-media` and store its public URL on the
 * campaign. Resolves to the URL, or throws an Error whose message is French and
 * ready to show. Storage write is allowed for Cupdom members (policy 0021); the
 * campaign row update is gated by RLS like the other owner-only header fields.
 */
export async function uploadProductPhoto(slug: string, file: File): Promise<string> {
  const check = validateProductPhoto(file);
  if (!check.ok) throw new Error(check.error);

  const supabase = createClient();
  const path = productPhotoPath(slug, check.ext);
  const { error } = await supabase.storage
    .from('sponsor-media')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(PRODUCT_PHOTO_UPLOAD_ERROR);

  const { data } = supabase.storage.from('sponsor-media').getPublicUrl(path);
  try {
    await setProductImageUrl(slug, data.publicUrl);
  } catch {
    throw new Error("Photo envoyée mais non enregistrée sur la campagne. Réessayez.");
  }
  return data.publicUrl;
}
