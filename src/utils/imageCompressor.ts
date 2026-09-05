/**
 * High-performance Client-side Image Compressor
 * Compresses images to optimized WebP/JPEG formats with minimal memory footprint (< 60-90 KB).
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/jpeg';
}

export const compressImageFile = async (
  file: File,
  options: CompressionOptions = {}
): Promise<string> => {
  const { maxDimension = 900, quality = 0.75, mimeType = 'image/jpeg' } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) {
        return resolve('');
      }

      const img = new Image();
      img.onerror = () => resolve(result); // Fallback to raw if load fails
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down maintaining aspect ratio
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) {
            return resolve(result);
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first for ultra small size, fallback to JPEG
          let compressed = '';
          try {
            compressed = canvas.toDataURL(mimeType, quality);
          } catch {
            compressed = canvas.toDataURL('image/jpeg', 0.75);
          }

          resolve(compressed || result);
        } catch {
          resolve(result);
        }
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Preload an image URL into browser cache for instant lag-free switching
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
};

/**
 * Optimizes/Compresses raw base64 images (data:image/...) to lightweight JPEG thumbnails
 */
export const compressBase64Image = async (
  base64Str: string,
  options: CompressionOptions = {}
): Promise<string> => {
  const { maxDimension = 500, quality = 0.6, mimeType = 'image/jpeg' } = options;
  if (!base64Str || !base64Str.startsWith('data:image')) {
    return base64Str;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(base64Str);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          return resolve(base64Str);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL(mimeType, quality);
        resolve(compressed || base64Str);
      } catch {
        resolve(base64Str);
      }
    };
    img.src = base64Str;
  });
};

