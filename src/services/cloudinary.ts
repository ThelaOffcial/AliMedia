/**
 * Cloudinary Direct Upload Service for AliMedia
 * Cloud Name: drmmn0xp3
 * Upload Preset: cartgo
 */

export const CLOUDINARY_CONFIG = {
  cloudName: 'drmmn0xp3',
  uploadPreset: 'cartgo',
  uploadUrl: 'https://api.cloudinary.com/v1_1/drmmn0xp3/image/upload'
};

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

/**
 * Uploads a file (image) directly to Cloudinary using unsigned preset 'cartgo'
 */
export async function uploadImageToCloudinary(
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'alimedia_elephants');

    xhr.open('POST', CLOUDINARY_CONFIG.uploadUrl);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response: CloudinaryUploadResponse = JSON.parse(xhr.responseText);
          if (response.secure_url) {
            resolve(response.secure_url);
          } else {
            reject(new Error('Cloudinary response missing secure_url'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response: ' + (e as Error).message));
        }
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}`;
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.error && errRes.error.message) {
            errorMsg = errRes.error.message;
          }
        } catch {
          // ignore
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during Cloudinary upload'));
    };

    xhr.send(formData);
  });
}
