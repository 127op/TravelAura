import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isDemo } from './firebase.js';
import { demoDb } from './demoService.js';

export function validateImage(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Please upload an image file.');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Image must be between 1 byte and 5 MB.');
}
export function createStorageService(firebaseStorage) {
  return async (file, path) => {
    validateImage(file);
    if (!/^(payments\/[^/]+\/[^/]+\/[^/]+|destinations\/[^/]+|packages\/[^/]+)$/.test(path)) {
      throw new Error('Invalid image upload location.');
    }
    const result = await uploadBytes(ref(firebaseStorage, path), file, { contentType: file.type });
    return getDownloadURL(result.ref);
  };
}
export const uploadFile = isDemo ? async file => { validateImage(file); return demoDb.uploadFile(file); } : createStorageService(storage);
