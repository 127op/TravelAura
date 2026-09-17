import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isDemo } from './firebase.js';
import { demoDb } from './demoService.js';

export function validateImage(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Please upload an image file.');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Image must be between 1 byte and 5 MB.');
}
function compressCatalogImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Unable to process this image.'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.65);
        if (data.length > 800000) return reject(new Error('This image is too detailed to save. Choose a smaller image.'));
        resolve(data);
      };
      image.onerror = () => reject(new Error('Unable to process this image.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
}
export function createStorageService(firebaseStorage) {
  return async (file, path) => {
    validateImage(file);
    if (/^(destinations|packages)\//.test(path)) return compressCatalogImage(file);
    if (!/^(payments\/[^/]+\/[^/]+\/[^/]+|destinations\/[^/]+|packages\/[^/]+)$/.test(path)) {
      throw new Error('Invalid image upload location.');
    }
    if (!firebaseStorage) throw new Error('Image storage is unavailable. Submit payment confirmation without an attachment.');
    const result = await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type });
    return getDownloadURL(result.ref);
  };
}
export const uploadFile = isDemo ? async file => { validateImage(file); return demoDb.uploadFile(file); } : createStorageService(storage);
