import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
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

// Normalize file URI for Firebase Storage
const normalizeUri = (uri: string): string => {
  // On iOS, sometimes URIs have the file:// prefix that needs to be handled
  // On Android, content:// URIs need to be used directly
  if (Platform.OS === 'ios' && uri.startsWith('file://')) {
    return uri;
  }
  if (Platform.OS === 'android' && uri.startsWith('content://')) {
    return uri;
  }
  // Add file:// prefix if missing on iOS
  if (Platform.OS === 'ios' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
    return `file://${uri}`;
  }
  return uri;
};

// Upload file with progress callback
export const uploadFile = async (
  path: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  try {
    const normalizedUri = normalizeUri(localUri);
    console.log('Uploading file from:', normalizedUri, 'to path:', path);

    const reference = storage().ref(path);
    const task = reference.putFile(normalizedUri);

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
    console.log('Upload successful, URL:', url);
    return { success: true, url };
  } catch (error: any) {
    console.error('Upload error:', error.code, error.message);
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'Storage access denied. Please check Firebase Storage rules.';
    } else if (error.code === 'storage/canceled') {
      errorMessage = 'Upload was cancelled.';
    } else if (error.code === 'storage/unknown') {
      errorMessage = 'An unknown error occurred. Please try again.';
    }
    return { success: false, error: errorMessage };
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
