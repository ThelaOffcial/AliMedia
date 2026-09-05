// Cloudinary is configured with fixed, hardcoded credentials for this project.
// There is intentionally no admin UI or database document to change these at
// runtime - if they ever need to change, update the two constants below.
const CLOUDINARY_CLOUD_NAME = 'drmmn0xp3';
const CLOUDINARY_UPLOAD_PRESET = 'alimanagement';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

/**
 * Uploads a base64 image or a File object directly to Cloudinary using an
 * unsigned upload preset. Returns both the secure_url and public_id.
 */
export async function uploadPhotoToCloudinary(imageSource: string | File): Promise<CloudinaryUploadResult> {
  if (!imageSource) {
    throw new Error('No image source provided for Cloudinary upload.');
  }

  // If it's already a hosted HTTP/HTTPS URL (e.g. from an existing upload),
  // there is nothing to upload - return it as-is.
  if (typeof imageSource === 'string' && (imageSource.startsWith('https://') || imageSource.startsWith('http://'))) {
    return {
      url: imageSource,
      publicId: '',
    };
  }

  const formData = new FormData();
  formData.append('file', imageSource);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', 'alimedia_uploads');

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[CLOUDINARY] API Error Response:', response.status, errText);
      throw new Error(`Cloudinary error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    const finalUrl = result.secure_url || result.url;
    const finalPublicId = result.public_id || '';

    if (!finalUrl || finalUrl.startsWith('data:')) {
      throw new Error('Cloudinary did not return a valid hosted image URL.');
    }

    return {
      url: finalUrl,
      publicId: finalPublicId,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Cloudinary upload timed out after 30 seconds. Please check your network.');
    }
    console.error('[CLOUDINARY] Upload error:', err);
    throw err;
  }
}

/**
 * Uploads an image to Cloudinary and returns only the URL string (for
 * call sites that only need the URL).
 */
export async function uploadImageToCloudinary(imageSource: string | File): Promise<string> {
  const result = await uploadPhotoToCloudinary(imageSource);
  return result.url;
}
