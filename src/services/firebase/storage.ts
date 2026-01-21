import storage from '@react-native-firebase/storage';
import { StoragePaths } from './config';

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

// Upload file with progress callback
export const uploadFile = async (
  path: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  try {
    const reference = storage().ref(path);
    const task = reference.putFile(localUri);

    if (onProgress) {
      task.on('state_changed', (snapshot) => {
        onProgress({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        });
      });
    }

    await task;
    const url = await reference.getDownloadURL();
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Upload profile photo
export const uploadProfilePhoto = async (
  userId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const extension = localUri.split('.').pop() || 'jpg';
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
  const extension = localUri.split('.').pop() || 'mp4';
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
  const extension = localUri.split('.').pop() || 'jpg';
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
  const extension = localUri.split('.').pop() || 'pdf';
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
  const extension = localUri.split('.').pop() || 'pdf';
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
  const extension = localUri.split('.').pop() || 'pdf';
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
  const extension = localUri.split('.').pop() || 'pdf';
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
  const extension = localUri.split('.').pop() || 'jpg';
  const path = `${StoragePaths.MESSAGE_ATTACHMENTS}/${conversationId}/${messageId}.${extension}`;
  return uploadFile(path, localUri, onProgress);
};

// Delete file
export const deleteFile = async (
  path: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await storage().ref(path).delete();
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
    const url = await storage().ref(path).getDownloadURL();
    return { success: true, url };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
