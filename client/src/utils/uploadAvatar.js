import { storage } from '../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const MAX_SIZE  = 2 * 1024 * 1024          // 2 MB
const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Uploads a profile avatar to Firebase Storage and returns the public download URL.
 * @param {File}   file    - The image File object from an <input type="file">
 * @param {string} userId  - The authenticated user's UID (used as the storage path)
 * @returns {Promise<string>} The permanent download URL
 * @throws {Error} with a user-readable message on validation or upload failure
 */
export async function uploadAvatar(file, userId) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WebP, or GIF images are allowed.')
  }
  if (file.size > MAX_SIZE) {
    throw new Error('Image must be under 2 MB.')
  }

  // Always write to the same path so old avatars are automatically overwritten
  const storageRef = ref(storage, `avatars/${userId}/avatar`)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}
