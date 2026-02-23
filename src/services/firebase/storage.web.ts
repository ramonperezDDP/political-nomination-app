import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { firebaseApp, StoragePaths } from './config';

const storage = getStorage(firebaseApp);

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
}

// Upload file with progress callback (web: fetch URI as blob then upload)
export const uploadFile = async (
  path: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  try {
    console.log('Uploading file from:', localUri, 'to path:', path);

    // Fetch the file URI as a blob (works for data URIs, object URLs, and remote URLs)
    const response = await fetch(localUri);
    const blob = await response.blob();

    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, blob);

    return new Promise<UploadResult>((resolve) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (onProgress) {
            onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            });
          }
        },
        (error: any) => {
          console.error('Upload error:', error.code, error.message);
          let errorMessage = error.message;
          if (error.code === 'storage/unauthorized') {
            errorMessage = 'Storage access denied. Please check Firebase Storage rules.';
          } else if (error.code === 'storage/canceled') {
            errorMessage = 'Upload was cancelled.';
          } else if (error.code === 'storage/unknown') {
            errorMessage = 'An unknown error occurred. Please try again.';
          }
          resolve({ success: false, error: errorMessage });
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          console.log('Upload successful, URL:', url);
          resolve({ success: true, url });
        }
      );
    });
  } catch (error: any) {
    console.error('Upload error:', error.message);
    return { success: false, error: error.message };
  }
};

// Upload profile photo
export const uploadProfilePhoto = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const extension = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${StoragePaths.PROFILE_PHOTOS}/${userId}/profile.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload PSA video
export const uploadPSAVideo = async (
  candidateId: string,
  psaId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const extension = localUri.split('.').pop()?.split('?')[0] || 'mp4';
  const path = `${StoragePaths.PSA_VIDEOS}/${candidateId}/${psaId}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload PSA thumbnail
export const uploadPSAThumbnail = async (
  candidateId: string,
  psaId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const extension = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${StoragePaths.PSA_THUMBNAILS}/${candidateId}/${psaId}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload signature document
export const uploadSignatureDoc = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const timestamp = Date.now();
  const extension = localUri.split('.').pop()?.split('?')[0] || 'pdf';
  const path = `${StoragePaths.SIGNATURE_DOCS}/${userId}/signatures_${timestamp}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload ID document
export const uploadIdDoc = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const timestamp = Date.now();
  const extension = localUri.split('.').pop()?.split('?')[0] || 'pdf';
  const path = `${StoragePaths.ID_DOCS}/${userId}/id_${timestamp}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload resume
export const uploadResume = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const timestamp = Date.now();
  const extension = localUri.split('.').pop()?.split('?')[0] || 'pdf';
  const path = `${StoragePaths.RESUMES}/${userId}/resume_${timestamp}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload tax returns
export const uploadTaxReturns = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const timestamp = Date.now();
  const extension = localUri.split('.').pop()?.split('?')[0] || 'pdf';
  const path = `${StoragePaths.TAX_RETURNS}/${userId}/tax_${timestamp}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Upload message attachment
export const uploadMessageAttachment = async (
  conversationId: string,
  messageId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const extension = localUri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `${StoragePaths.MESSAGE_ATTACHMENTS}/${conversationId}/${messageId}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Delete file
export const deleteFile = async (
  path: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await deleteObject(ref(storage, path));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Get download URL
export const getDownloadUrl = async (
  path: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const url = await getDownloadURL(ref(storage, path));
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
